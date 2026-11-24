import { renderScene } from "./backgrounds";

/*
 * Camera track -> person segmentation (MediaPipe selfie segmenter) -> composited canvas -> new track.
 *
 * - Segmentation runs on a small 256x144 frame (fast); the mask is upscaled with smoothing.
 * - The mask is blended with the previous frame so the outline doesn't shimmer/flicker.
 * - Frames are driven by a Worker timer, so the outgoing video keeps running when the tab
 *   is in the background (requestAnimationFrame would pause and freeze your video for others).
 * - One output track is kept for the lifetime of the camera track; changing the effect only
 *   swaps what is drawn, so peers never need a new track.
 * - Optional auto-framing (like Meet/Zoom "center stage"): a face detector finds the speaker's
 *   face, and every draw reads from a crop of the camera frame (digital pan/zoom).
 *   Stability rules: the face box is smoothed; the camera only re-frames when the face has
 *   clearly moved out of its comfort zone AND stayed there (dwell); each re-frame is a single
 *   time-based ease-in-out glide. When you sit still the crop doesn't move at all.
 *   Framing off = full frame, identical to having no framing.
 */

const TASKS_VISION_VERSION = "1.2.3";
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`;
const WASM_URL = `${CDN}/wasm`;
const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite";

const SEG_W = 256;
const SEG_H = 144;
const MAX_W = 1280;
const FPS = 30;

const FACE_MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

// Auto-framing tuning (positions/sizes are fractions of the camera frame, times in ms)
const MAX_ZOOM = 1.8; // never crop tighter than this: webcams get visibly soft beyond ~2x
const DETECT_EVERY_MS = 100; // face detection ~10x per second (cheap)
const FACE_SMOOTHING = 0.25; // exponential smoothing of the detected face box
const FACE_TO_CROP = 3.4; // crop height = face height x this -> head & shoulders
const EYE_LINE = 0.42; // face centre sits this far down from the top of the crop
const COMFORT = 0.12; // the face may drift this much (fraction of the crop) before re-framing
const ZOOM_TOLERANCE = 0.15; // relative size change needed before re-zooming
const DWELL_MS = 700; // a change must persist this long before the camera moves
const MOVE_MS = 900; // duration of one smooth camera glide
const LOST_MS = 2000; // no face for this long -> glide back to the full frame
const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });
const DET_W = 320;
const DET_H = 180;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

let visionPromise = null;
const loadVision = () => {
    if (!visionPromise) {
        visionPromise = (async () => {
            const mod = await import(/* webpackIgnore: true */ `${CDN}/vision_bundle.mjs`);
            const fileset = await mod.FilesetResolver.forVisionTasks(WASM_URL);
            return { mod, fileset };
        })().catch((e) => {
            visionPromise = null;
            throw e;
        });
    }
    return visionPromise;
};

const withGpuFallback = async (create) => {
    try {
        return await create("GPU");
    } catch {
        return await create("CPU");
    }
};

let segmenterPromise = null;
const loadSegmenter = () => {
    if (!segmenterPromise) {
        segmenterPromise = loadVision()
            .then(({ mod, fileset }) =>
                withGpuFallback((delegate) =>
                    mod.ImageSegmenter.createFromOptions(fileset, {
                        baseOptions: { modelAssetPath: MODEL_URL, delegate },
                        runningMode: "VIDEO",
                        outputConfidenceMasks: true,
                        outputCategoryMask: false,
                    })
                )
            )
            .catch((e) => {
                segmenterPromise = null; // allow a retry later
                throw e;
            });
    }
    return segmenterPromise;
};

let faceDetectorPromise = null;
const loadFaceDetector = () => {
    if (!faceDetectorPromise) {
        faceDetectorPromise = loadVision()
            .then(({ mod, fileset }) =>
                withGpuFallback((delegate) =>
                    mod.FaceDetector.createFromOptions(fileset, {
                        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
                        runningMode: "VIDEO",
                        minDetectionConfidence: 0.6,
                    })
                )
            )
            .catch((e) => {
                faceDetectorPromise = null;
                throw e;
            });
    }
    return faceDetectorPromise;
};

/** Start downloading the model early (e.g. when the picker opens). */
export const preloadSegmenter = () => loadSegmenter().catch(() => {});

const makeTicker = (fps, onTick) => {
    const src = "let t;onmessage=e=>{clearInterval(t);if(e.data>0)t=setInterval(()=>postMessage(0),e.data)}";
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = onTick;
    worker.postMessage(Math.round(1000 / fps));
    return () => {
        worker.postMessage(0);
        worker.terminate();
    };
};

const canvas2d = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d", { willReadFrequently: false })];
};

const drawCover = (ctx, img, w, h) => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
};

export async function createBackgroundProcessor(inputTrack, initialEffect, initialOptions = {}) {
    // Only wait for the segmentation model if an effect needs it right now; otherwise load lazily.
    let segmenter = initialEffect?.type !== "none" ? await loadSegmenter() : null;
    let segmenterLoading = false;
    const ensureSegmenter = () => {
        if (segmenter || segmenterLoading) return;
        segmenterLoading = true;
        loadSegmenter()
            .then((sg) => (segmenter = sg))
            .catch((e) => console.warn("Background effect unavailable", e))
            .finally(() => (segmenterLoading = false));
    };

    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([inputTrack]);
    await video.play().catch(() => {});
    if (!video.videoWidth) {
        await new Promise((resolve) => {
            video.onloadedmetadata = resolve;
            setTimeout(resolve, 2000);
        });
    }

    const scale = Math.min(1, MAX_W / (video.videoWidth || 640));
    const W = Math.round((video.videoWidth || 640) * scale);
    const H = Math.round((video.videoHeight || 360) * scale);

    const [out, ctx] = canvas2d(W, H);
    const [fg, fgCtx] = canvas2d(W, H);
    const [seg, segCtx] = canvas2d(SEG_W, SEG_H);
    const [mask, maskCtx] = canvas2d(SEG_W, SEG_H);
    const [small, smallCtx] = canvas2d(Math.max(1, Math.round(W / 12)), Math.max(1, Math.round(H / 12)));
    const [det, detCtx] = canvas2d(DET_W, DET_H);

    const filterOK = typeof ctx.filter === "string";
    const maskImage = maskCtx.createImageData(SEG_W, SEG_H);
    for (let i = 0; i < maskImage.data.length; i += 4) {
        maskImage.data[i] = 255;
        maskImage.data[i + 1] = 255;
        maskImage.data[i + 2] = 255;
    }
    const prevAlpha = new Float32Array(SEG_W * SEG_H);

    let effect = initialEffect;
    let bgImage = null;
    let hasMask = false;
    let busy = false;
    let stopped = false;
    let lastTs = 0;

    // ---------------- Auto-framing ----------------
    let autoFrame = !!initialOptions.autoFrame;
    let detector = null;
    let detectorLoading = false;
    let lastDetectAt = 0;
    let lastDetectTs = 0;
    let face = null; // smoothed { cx, cy, h } of the main face
    let lastFaceAt = 0;
    let target = { ...FULL }; // where the camera is (or is gliding to)
    let crop = { ...FULL }; // what is drawn this frame
    let glide = null; // { from, to, start }
    let pending = null; // proposed new framing waiting out the dwell time
    let pendingSince = 0;

    const ensureDetector = () => {
        if (detector || detectorLoading) return;
        detectorLoading = true;
        loadFaceDetector()
            .then((d) => (detector = d))
            .catch((e) => console.warn("Auto-framing unavailable", e)) // framing just stays off
            .finally(() => (detectorLoading = false));
    };
    if (autoFrame) ensureDetector();

    /** Draw the (cropped) camera frame into a destination rect. Full crop == plain drawImage. */
    const drawVideo = (c, dx, dy, dw, dh) => {
        const vw = video.videoWidth || W;
        const vh = video.videoHeight || H;
        c.drawImage(video, crop.x * vw, crop.y * vh, crop.w * vw, crop.h * vh, dx, dy, dw, dh);
    };

    const moveTo = (to, now) => {
        target = { ...to };
        glide = { from: { ...crop }, to: target, start: now };
        pending = null;
    };

    /** Head-and-shoulders framing for a face; keeps the camera's aspect ratio. */
    const framingFor = (f) => {
        const size = clamp(f.h * FACE_TO_CROP, 1 / MAX_ZOOM, 1);
        return {
            x: clamp(f.cx - size / 2, 0, 1 - size),
            y: clamp(f.cy - size * EYE_LINE, 0, 1 - size),
            w: size,
            h: size,
        };
    };

    const differsEnough = (a, b) =>
        Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) > COMFORT * b.w ||
        Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) > COMFORT * b.h ||
        Math.abs(a.w - b.w) > ZOOM_TOLERANCE * b.w;

    const detectFace = (now) => {
        if (!detector || now - lastDetectAt < DETECT_EVERY_MS) return;
        lastDetectAt = now;
        detCtx.drawImage(video, 0, 0, DET_W, DET_H); // always the FULL frame: no feedback from the crop
        const ts = Math.max(now, lastDetectTs + 1);
        lastDetectTs = ts;
        const res = detector.detectForVideo(det, ts);
        let best = null;
        for (const d of res?.detections || []) {
            const bb = d.boundingBox;
            if (bb && (!best || bb.width * bb.height > best.width * best.height)) best = bb;
        }
        if (!best) return;
        const m = {
            cx: (best.originX + best.width / 2) / DET_W,
            cy: (best.originY + best.height / 2) / DET_H,
            h: best.height / DET_H,
        };
        face = face
            ? {
                  cx: lerp(face.cx, m.cx, FACE_SMOOTHING),
                  cy: lerp(face.cy, m.cy, FACE_SMOOTHING),
                  h: lerp(face.h, m.h, FACE_SMOOTHING),
              }
            : m;
        lastFaceAt = now;
    };

    const updateFraming = (now) => {
        if (!autoFrame) {
            face = null;
            pending = null;
            if (target.w !== 1 && !(glide && glide.to.w === 1)) moveTo(FULL, now);
        } else {
            try {
                detectFace(now);
            } catch {
                /* a failed detection just keeps the current framing */
            }
            if (face && now - lastFaceAt > LOST_MS) face = null;
            const desired = face ? framingFor(face) : FULL;
            if (!differsEnough(desired, target)) {
                pending = null; // still inside the comfort zone: the camera stays perfectly still
            } else if (!pending) {
                pending = desired;
                pendingSince = now;
            } else {
                pending = desired; // follow the latest proposal while waiting
                if (now - pendingSince >= DWELL_MS) moveTo(pending, now);
            }
        }

        if (glide) {
            const t = clamp((now - glide.start) / MOVE_MS, 0, 1);
            const e = easeInOutCubic(t);
            crop = {
                x: lerp(glide.from.x, glide.to.x, e),
                y: lerp(glide.from.y, glide.to.y, e),
                w: lerp(glide.from.w, glide.to.w, e),
                h: lerp(glide.from.h, glide.to.h, e),
            };
            if (t >= 1) {
                crop = { ...glide.to };
                glide = null;
            }
        }
    };

    const loadEffectAssets = (eff) => {
        bgImage = null;
        if (eff?.type === "image" && eff.src) {
            const img = new Image();
            img.onload = () => {
                if (effect === eff) bgImage = img;
            };
            img.src = eff.src;
        }
    };
    loadEffectAssets(effect);

    const drawBackground = () => {
        if (effect.type === "blur") {
            const px = Math.max(2, Math.round((effect.amount * W) / 640));
            if (filterOK) {
                ctx.filter = `blur(${px}px)`;
                drawVideo(ctx, -px * 2, -px * 2, W + px * 4, H + px * 4);
                ctx.filter = "none";
            } else {
                drawVideo(smallCtx, 0, 0, small.width, small.height);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(small, 0, 0, W, H);
            }
        } else if (effect.type === "scene") {
            ctx.drawImage(renderScene(effect, W, H), 0, 0);
        } else if (effect.type === "image" && bgImage) {
            drawCover(ctx, bgImage, W, H);
        } else {
            drawVideo(ctx, 0, 0, W, H);
        }
    };

    const updateMask = () => {
        segCtx.drawImage(video, 0, 0, SEG_W, SEG_H);
        const ts = Math.max(performance.now(), lastTs + 1);
        lastTs = ts;
        const result = segmenter.segmentForVideo(seg, ts);
        try {
            const masks = result.confidenceMasks || [];
            // single-output model = person probability; multi-class models put background first
            const m = masks.length > 1 ? masks[1] : masks[0];
            if (!m) return;
            const conf = m.getAsFloat32Array();
            const data = maskImage.data;
            for (let i = 0; i < conf.length; i++) {
                // sharpen the edge a little, then blend with the previous frame to stop shimmer
                let a = (conf[i] - 0.25) / 0.5;
                a = a < 0 ? 0 : a > 1 ? 1 : a;
                a = hasMask ? prevAlpha[i] * 0.45 + a * 0.55 : a;
                prevAlpha[i] = a;
                data[i * 4 + 3] = a * 255;
            }
            maskCtx.putImageData(maskImage, 0, 0);
            hasMask = true;
        } finally {
            result.close?.();
        }
    };

    const frame = () => {
        if (stopped || busy || video.readyState < 2) return;
        busy = true;
        try {
            const now = performance.now();
            const hasEffect = effect.type !== "none";

            try {
                updateFraming(now);
            } catch {
                crop = { ...FULL }; // framing must never break the video
                glide = null;
            }

            if (hasEffect) {
                if (!segmenter) ensureSegmenter();
                else {
                    try {
                        updateMask();
                    } catch {
                        // keep last mask on a transient failure
                    }
                }
            }

            if (!hasEffect || !hasMask) {
                drawVideo(ctx, 0, 0, W, H);
                return;
            }
            drawBackground();

            fgCtx.globalCompositeOperation = "copy";
            fgCtx.filter = filterOK ? `blur(${Math.max(1, Math.round(W / 400))}px)` : "none";
            // the mask is in full-frame coordinates: cut out the same crop as the video
            fgCtx.drawImage(mask, crop.x * SEG_W, crop.y * SEG_H, crop.w * SEG_W, crop.h * SEG_H, 0, 0, W, H);
            fgCtx.filter = "none";
            fgCtx.globalCompositeOperation = "source-in";
            drawVideo(fgCtx, 0, 0, W, H);
            fgCtx.globalCompositeOperation = "source-over";

            ctx.drawImage(fg, 0, 0);
        } finally {
            busy = false;
        }
    };

    // draw one frame immediately so the output track never starts black
    ctx.drawImage(video, 0, 0, W, H);
    const stopTicker = makeTicker(FPS, frame);
    const stream = out.captureStream(FPS);
    const track = stream.getVideoTracks()[0];
    if ("contentHint" in track) track.contentHint = "motion";

    return {
        track,
        setEffect(next) {
            if (!next || next === effect) return;
            effect = next;
            if (next.type !== "none") ensureSegmenter();
            loadEffectAssets(next);
        },
        setOptions(opts = {}) {
            if ("autoFrame" in opts) {
                autoFrame = !!opts.autoFrame; // turning off glides back to the full frame
                if (autoFrame) ensureDetector();
            }
        },
        stop() {
            stopped = true;
            stopTicker();
            track.stop();
            video.pause();
            video.srcObject = null;
        },
    };
}
