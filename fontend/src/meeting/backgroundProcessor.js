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

export async function createBackgroundProcessor(inputTrack, initialEffect) {
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
                ctx.drawImage(video, -px * 2, -px * 2, W + px * 4, H + px * 4);
                ctx.filter = "none";
            } else {
                smallCtx.drawImage(video, 0, 0, small.width, small.height);
                ctx.imageSmoothingEnabled = true;
                ctx.drawImage(small, 0, 0, W, H);
            }
        } else if (effect.type === "scene") {
            ctx.drawImage(renderScene(effect, W, H), 0, 0);
        } else if (effect.type === "image" && bgImage) {
            drawCover(ctx, bgImage, W, H);
        } else {
            ctx.drawImage(video, 0, 0, W, H);
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
            if (effect.type === "none") {
                ctx.drawImage(video, 0, 0, W, H);
                return;
            }
            try {
                updateMask();
            } catch (e) {
                // keep last mask on a transient failure
            }
            if (!hasMask) {
                ctx.drawImage(video, 0, 0, W, H);
                return;
            }
            drawBackground();

            fgCtx.globalCompositeOperation = "copy";
            fgCtx.filter = filterOK ? `blur(${Math.max(1, Math.round(W / 400))}px)` : "none";
            fgCtx.drawImage(mask, 0, 0, W, H);
            fgCtx.filter = "none";
            fgCtx.globalCompositeOperation = "source-in";
            fgCtx.drawImage(video, 0, 0, W, H);
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
        stop() {
            stopped = true;
            stopTicker();
            track.stop();
            video.pause();
            video.srcObject = null;
        },
    };
}
