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
 * - Optional auto-framing: the person mask gives a bounding box, and every draw reads from a
 *   smoothly eased crop of the camera frame (a digital pan/zoom). With framing off the crop
 *   is the full frame, so the output is identical to having no framing at all.
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

// Auto-framing tuning (all values are fractions of the camera frame)
const MIN_CROP = 0.55; // max ~1.8x zoom: more than that gets visibly soft on webcams
const FRAME_MASK_EVERY = 3; // with no background effect, segment every 3rd frame (~10 fps) to save CPU
const EASE = 0.07; // per-frame easing toward the goal crop (~1 s to settle)
const DEADZONE_MOVE = 0.035; // ignore small shifts so the frame doesn't wobble
const DEADZONE_SIZE = 0.05;
const LOST_FRAMES = 45; // ~1.5 s without a person -> ease back to the full frame
const FULL = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

let segmenterPromise = null;

const loadSegmenter = () => {
    if (!segmenterPromise) {
        segmenterPromise = (async () => {
            const { FilesetResolver, ImageSegmenter } = await import(/* webpackIgnore: true */ `${CDN}/vision_bundle.mjs`);
            const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
            const make = (delegate) =>
                ImageSegmenter.createFromOptions(fileset, {
                    baseOptions: { modelAssetPath: MODEL_URL, delegate },
                    runningMode: "VIDEO",
                    outputConfidenceMasks: true,
                    outputCategoryMask: false,
                });
            try {
                return await make("GPU");
            } catch {
                return await make("CPU");
            }
        })().catch((e) => {
            segmenterPromise = null; // allow a retry later
            throw e;
        });
    }
    return segmenterPromise;
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
    const segmenter = await loadSegmenter();

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

    let autoFrame = !!initialOptions.autoFrame;
    let crop = { ...FULL }; // what is drawn right now
    let goal = { ...FULL }; // where the crop is easing to
    let lostFor = 0;
    let frameNo = 0;

    /** Draw the (cropped) camera frame into a destination rect. Full crop == plain drawImage. */
    const drawVideo = (c, dx, dy, dw, dh) => {
        const vw = video.videoWidth || W;
        const vh = video.videoHeight || H;
        c.drawImage(video, crop.x * vw, crop.y * vh, crop.w * vw, crop.h * vh, dx, dy, dw, dh);
    };

    /** Person bounding box from the smoothed mask, or null when nobody is in frame. */
    const personBox = () => {
        const cols = new Float32Array(SEG_W);
        let top = -1;
        let bottom = -1;
        let total = 0;
        for (let y = 0; y < SEG_H; y++) {
            let rowCount = 0;
            const row = y * SEG_W;
            for (let x = 0; x < SEG_W; x++) {
                if (prevAlpha[row + x] > 0.5) {
                    cols[x]++;
                    rowCount++;
                }
            }
            if (rowCount >= 3) {
                if (top < 0) top = y;
                bottom = y;
            }
            total += rowCount;
        }
        if (top < 0 || total < SEG_W * SEG_H * 0.01) return null; // <1% of the frame: treat as nobody
        // horizontal extent by mass percentiles, so a stray hand/edge pixel doesn't widen the box
        let acc = 0;
        let left = 0;
        let right = SEG_W - 1;
        for (let x = 0; x < SEG_W; x++) {
            acc += cols[x];
            if (acc >= total * 0.03) {
                left = x;
                break;
            }
        }
        acc = 0;
        for (let x = SEG_W - 1; x >= 0; x--) {
            acc += cols[x];
            if (acc >= total * 0.03) {
                right = x;
                break;
            }
        }
        return { x0: left / SEG_W, x1: (right + 1) / SEG_W, y0: top / SEG_H, y1: (bottom + 1) / SEG_H };
    };

    /** Head-and-shoulders framing around the person, keeping the camera's aspect ratio. */
    const framingFor = (b) => {
        const bw = b.x1 - b.x0;
        // only look at the upper body: roughly one shoulder-width below the top of the head
        // (bw is a fraction of the width; convert that distance into a fraction of the height)
        const bh = Math.min(b.y1, b.y0 + bw * 0.9 * (W / H)) - b.y0;
        const size = clamp(Math.max(bw * 1.75, bh * 1.25), MIN_CROP, 1);
        const cx = (b.x0 + b.x1) / 2;
        return {
            x: clamp(cx - size / 2, 0, 1 - size),
            y: clamp(b.y0 - size * 0.14, 0, 1 - size), // a little headroom above the head
            w: size,
            h: size,
        };
    };

    const updateGoal = (maskFresh) => {
        if (!autoFrame) {
            goal = { ...FULL };
            lostFor = 0;
            return;
        }
        if (!maskFresh) return;
        const box = personBox();
        if (!box) {
            if (++lostFor >= LOST_FRAMES / (effect.type === "none" ? FRAME_MASK_EVERY : 1)) goal = { ...FULL };
            return;
        }
        lostFor = 0;
        const next = framingFor(box);
        const moved =
            Math.abs(next.x + next.w / 2 - (goal.x + goal.w / 2)) > DEADZONE_MOVE ||
            Math.abs(next.y - goal.y) > DEADZONE_MOVE ||
            Math.abs(next.w - goal.w) > DEADZONE_SIZE;
        if (moved) goal = next;
    };

    const easeCrop = () => {
        const k = EASE;
        const w = crop.w + (goal.w - crop.w) * k;
        let x = crop.x + (goal.x - crop.x) * k;
        let y = crop.y + (goal.y - crop.y) * k;
        x = clamp(x, 0, 1 - w);
        y = clamp(y, 0, 1 - w);
        crop = { x, y, w, h: w };
        // snap when close, so "framing off" ends at exactly the untouched full frame
        if (Math.abs(crop.w - goal.w) < 0.002 && Math.abs(crop.x - goal.x) < 0.002 && Math.abs(crop.y - goal.y) < 0.002) {
            crop = { ...goal };
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
            const hasEffect = effect.type !== "none";
            // the mask is needed for the effect, or (less often) to find the person for framing
            let maskFresh = false;
            if (hasEffect || (autoFrame && frameNo++ % FRAME_MASK_EVERY === 0)) {
                try {
                    updateMask();
                    maskFresh = true;
                } catch (e) {
                    // keep last mask on a transient failure
                }
            }
            try {
                updateGoal(maskFresh && hasMask);
                easeCrop();
            } catch (e) {
                crop = { ...FULL }; // framing must never break the video
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
            loadEffectAssets(next);
        },
        setOptions(opts = {}) {
            if ("autoFrame" in opts) autoFrame = !!opts.autoFrame; // turning off eases back to the full frame
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
