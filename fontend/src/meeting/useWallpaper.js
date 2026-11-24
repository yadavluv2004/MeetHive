import { useCallback, useMemo, useState } from "react";
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

/**
 * Page wallpaper for the lobby and the meeting room.
 * "theme" = the plain app theme background; scenes are painted; "custom" is an uploaded image.
 */
export default function useWallpaper() {
    const [id, setId] = useState(() => read(KEY) || "theme");
    const [customSrc, setCustomSrc] = useState(() => read(CUSTOM_KEY));

    const image = useMemo(() => {
        if (id === "custom") return customSrc || null;
        const scene = WALLPAPERS.find((b) => b.id === id);
        return scene ? renderScene(scene, 1600, 900).toDataURL("image/jpeg", 0.9) : null;
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

    return { id: image ? id : "theme", customSrc, image, style, select, setCustomImage, removeCustomImage };
}
