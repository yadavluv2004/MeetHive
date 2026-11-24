import { useCallback, useEffect, useState } from "react";
import { BACKGROUNDS, renderScene } from "./backgrounds";

const KEY = "meethive:wallpaper";
const CUSTOM_KEY = "meethive:wallpaper-custom";

const read = (k) => {
    try {
        return localStorage.getItem(k);
    } catch {
        return null;
    }
};
const write = (k, v) => {
    try {
        if (v == null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
    } catch {
        /* quota - keep it for this session only */
    }
};

export const WALLPAPERS = BACKGROUNDS.filter((b) => b.type === "scene");

// Rendered wallpapers, kept for the whole session: scene id -> Promise<blob: URL>.
// A short blob: URL is much cheaper for the browser than a ~300 KB base64 data URL in a CSS variable,
// and toBlob() encodes the JPEG off the main thread, so selecting a wallpaper doesn't freeze the UI.
const sceneUrls = new Map();
const sceneUrl = (scene) => {
    if (!sceneUrls.has(scene.id)) {
        const p = new Promise((resolve) => {
            const canvas = renderScene(scene, 1600, 900);
            canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/jpeg", 0.9)), "image/jpeg", 0.9);
        });
        sceneUrls.set(scene.id, p);
    }
    return sceneUrls.get(scene.id);
};

/**
 * Page wallpaper for the lobby and the meeting room.
 * "theme" = the plain app theme background; scenes are painted; "custom" is an uploaded image.
 */
export default function useWallpaper() {
    const [id, setId] = useState(() => read(KEY) || "theme");
    const [customSrc, setCustomSrc] = useState(() => read(CUSTOM_KEY));

    const [image, setImage] = useState(null);

    // Resolve the image for the selected wallpaper. While a new scene renders (first use only),
    // the previous wallpaper stays on screen instead of flashing to the plain background.
    useEffect(() => {
        if (id === "custom") {
            setImage(customSrc || null);
            return undefined;
        }
        const scene = WALLPAPERS.find((b) => b.id === id);
        if (!scene) {
            setImage(null);
            return undefined;
        }
        let current = true;
        sceneUrl(scene).then((url) => current && setImage(url));
        return () => {
            current = false;
        };
    }, [id, customSrc]);

    const select = useCallback((next) => {
        setId(next);
        write(KEY, next);
    }, []);

    const setCustomImage = useCallback(
        (src) => {
            setCustomSrc(src);
            write(CUSTOM_KEY, src);
            select("custom");
        },
        [select]
    );

    const removeCustomImage = useCallback(() => {
        setCustomSrc(null);
        write(CUSTOM_KEY, null);
        select("theme");
    }, [select]);

    const style = image ? { "--wallpaper": `url("${image}")` } : undefined;

    const activeId = id === "custom" && !customSrc ? "theme" : WALLPAPERS.some((b) => b.id === id) || id === "custom" ? id : "theme";

    return { id: activeId, customSrc, image, style, select, setCustomImage, removeCustomImage };
}
