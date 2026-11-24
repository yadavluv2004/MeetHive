/*
 * Virtual background presets. Scenes are painted procedurally on a canvas, so no
 * image assets need to be shipped and thumbnails always match the real effect.
 */

const radial = (ctx, x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
};

const linear = (ctx, w, h, stops, angle = 0) => {
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * w;
    const y = Math.sin(rad) * h;
    const g = ctx.createLinearGradient(0, 0, x || w, y);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
};

// Deterministic "bokeh" circles so the scene is identical every frame
const bokeh = (ctx, w, h, color, count, seed) => {
    let s = seed;
    const rand = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
    };
    for (let i = 0; i < count; i++) {
        const r = (0.02 + rand() * 0.07) * w;
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
        ctx.fillStyle = color.replace("A", (0.05 + rand() * 0.18).toFixed(2));
        ctx.fill();
    }
};

export const BACKGROUNDS = [
    { id: "none", label: "None", type: "none" },
    { id: "blur-light", label: "Slight blur", type: "blur", amount: 6 },
    { id: "blur-strong", label: "Blur", type: "blur", amount: 16 },
    {
        id: "burgundy",
        label: "Burgundy",
        type: "scene",
        paint: (ctx, w, h) => {
            linear(ctx, w, h, [[0, "#2a1020"], [1, "#4a2236"]], 35);
            radial(ctx, w * 0.8, h * 0.2, w * 0.55, "rgba(251,207,232,0.35)");
            radial(ctx, w * 0.1, h * 0.95, w * 0.5, "rgba(244,114,182,0.25)");
            bokeh(ctx, w, h, "rgba(251,207,232,A)", 18, 7);
        },
    },
    {
        id: "blush",
        label: "Blush",
        type: "scene",
        paint: (ctx, w, h) => {
            linear(ctx, w, h, [[0, "#fde7f3"], [1, "#f9b8da"]], 60);
            radial(ctx, w * 0.25, h * 0.2, w * 0.5, "rgba(255,255,255,0.7)");
            bokeh(ctx, w, h, "rgba(255,255,255,A)", 22, 3);
        },
    },
    {
        id: "studio",
        label: "Studio",
        type: "scene",
        paint: (ctx, w, h) => {
            ctx.fillStyle = "#3b3b40";
            ctx.fillRect(0, 0, w, h);
            radial(ctx, w * 0.5, h * 0.4, w * 0.6, "rgba(200,200,210,0.55)");
            linear(ctx, w, h, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.45)"]], 90);
        },
    },
    {
        id: "office",
        label: "Office",
        type: "scene",
        paint: (ctx, w, h) => {
            // soft wall + window light + shelf lines - reads as an out-of-focus room
            linear(ctx, w, h, [[0, "#d9d2c7"], [1, "#b8ada0"]], 90);
            ctx.fillStyle = "rgba(255,255,255,0.55)";
            ctx.fillRect(w * 0.62, h * 0.08, w * 0.3, h * 0.55);
            ctx.fillStyle = "rgba(120,100,80,0.35)";
            ctx.fillRect(w * 0.06, h * 0.3, w * 0.4, h * 0.03);
            ctx.fillRect(w * 0.06, h * 0.55, w * 0.4, h * 0.03);
            ctx.fillStyle = "rgba(60,90,60,0.35)";
            ctx.beginPath();
            ctx.ellipse(w * 0.15, h * 0.22, w * 0.05, h * 0.09, 0, 0, Math.PI * 2);
            ctx.fill();
            radial(ctx, w * 0.77, h * 0.3, w * 0.45, "rgba(255,250,235,0.45)");
        },
        blurScene: 10,
    },
    {
        id: "midnight",
        label: "Midnight",
        type: "scene",
        paint: (ctx, w, h) => {
            linear(ctx, w, h, [[0, "#0a0f1e"], [1, "#1e1b4b"]], 45);
            radial(ctx, w * 0.85, h * 0.15, w * 0.5, "rgba(99,102,241,0.45)");
            radial(ctx, w * 0.1, h * 0.9, w * 0.45, "rgba(34,211,238,0.3)");
            bokeh(ctx, w, h, "rgba(165,180,252,A)", 16, 11);
        },
    },
    {
        id: "sunset",
        label: "Sunset",
        type: "scene",
        paint: (ctx, w, h) => {
            linear(ctx, w, h, [[0, "#ffb88c"], [0.5, "#de6262"], [1, "#5b2a5f"]], 90);
            radial(ctx, w * 0.5, h * 0.7, w * 0.35, "rgba(255,230,180,0.6)");
        },
    },
    {
        id: "forest",
        label: "Forest",
        type: "scene",
        paint: (ctx, w, h) => {
            linear(ctx, w, h, [[0, "#0f2a1d"], [1, "#2f5d3a"]], 80);
            radial(ctx, w * 0.6, h * 0.1, w * 0.6, "rgba(200,255,200,0.25)");
            bokeh(ctx, w, h, "rgba(220,255,200,A)", 20, 5);
        },
    },
];

export const CUSTOM_ID = "custom";

export const findBackground = (id, customSrc) => {
    if (id === CUSTOM_ID && customSrc) return { id: CUSTOM_ID, label: "Your image", type: "image", src: customSrc };
    return BACKGROUNDS.find((b) => b.id === id) || BACKGROUNDS[0];
};

/** Renders a scene to a canvas of the given size (cached per size). */
const sceneCache = new Map();
export const renderScene = (bg, w, h) => {
    const key = `${bg.id}:${w}x${h}`;
    if (sceneCache.has(key)) return sceneCache.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    bg.paint(ctx, w, h);
    if (bg.blurScene && typeof ctx.filter === "string") {
        const tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        const t = tmp.getContext("2d");
        t.filter = `blur(${Math.round((bg.blurScene * w) / 640)}px)`;
        t.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tmp, 0, 0);
    }
    sceneCache.set(key, canvas);
    return canvas;
};

/** Downscales an uploaded image to a JPEG data URL (keeps localStorage small). */
export const prepareCustomImage = (file, maxW = 1280, maxH = 720) =>
    new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) return reject(new Error("Please choose an image file"));
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxW / img.width, maxH / img.height);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Couldn't read that image"));
        };
        img.src = url;
    });
