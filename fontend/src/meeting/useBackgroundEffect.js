import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUSTOM_ID, findBackground } from "./backgrounds";

const EFFECT_KEY = "meethive:bg-effect";
const CUSTOM_KEY = "meethive:bg-custom";
const FRAME_KEY = "meethive:auto-frame";

const read = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const write = (key, value) => {
    try {
        if (value == null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
        return true;
    } catch {
        return false; // e.g. quota exceeded for a large custom image
    }
};

/**
 * Applies the selected virtual background and/or auto-framing to a camera track.
 * Returns the track to display/send (the raw track when nothing is active or
 * while the segmentation model is loading).
 */
export default function useBackgroundEffect(rawTrack) {
    const [effectId, setEffectId] = useState(() => read(EFFECT_KEY) || "none");
    const [customSrc, setCustomSrc] = useState(() => read(CUSTOM_KEY));
    const [autoFrame, setAutoFrameState] = useState(() => read(FRAME_KEY) === "1");
    const [outTrack, setOutTrack] = useState(null);
    const [status, setStatus] = useState("idle"); // idle | loading | ready | error

    const effect = useMemo(() => findBackground(effectId, customSrc), [effectId, customSrc]);
    const effectRef = useRef(effect);
    const autoFrameRef = useRef(autoFrame);
    const procRef = useRef(null);

    useEffect(() => {
        effectRef.current = effect;
        procRef.current?.setEffect(effect);
    }, [effect]);

    useEffect(() => {
        autoFrameRef.current = autoFrame;
        procRef.current?.setOptions?.({ autoFrame });
    }, [autoFrame]);

    const active = !!rawTrack && (effect.type !== "none" || autoFrame);

    useEffect(() => {
        if (!active) {
            setStatus("idle");
            return;
        }
        let cancelled = false;
        setStatus("loading");

        import("./backgroundProcessor")
            .then(({ createBackgroundProcessor }) => createBackgroundProcessor(rawTrack, effectRef.current, { autoFrame: autoFrameRef.current }))
            .then((proc) => {
                if (cancelled) {
                    proc.stop();
                    return;
                }
                procRef.current = proc;
                setOutTrack(proc.track);
                setStatus("ready");
            })
            .catch((e) => {
                console.warn("Background effect unavailable", e);
                if (!cancelled) setStatus("error");
            });

        return () => {
            cancelled = true;
            procRef.current?.stop();
            procRef.current = null;
            setOutTrack(null);
        };
    }, [rawTrack, active]);

    const select = useCallback((id) => {
        setEffectId(id);
        write(EFFECT_KEY, id);
    }, []);

    const setCustomImage = useCallback(
        (src) => {
            setCustomSrc(src);
            write(CUSTOM_KEY, src);
            select(CUSTOM_ID);
        },
        [select]
    );

    const setAutoFrame = useCallback((on) => {
        setAutoFrameState(!!on);
        write(FRAME_KEY, on ? "1" : null);
    }, []);

    const track = active && outTrack && status === "ready" ? outTrack : rawTrack;

    return { track, effectId: effect.id, customSrc, status, select, setCustomImage, autoFrame, setAutoFrame };
}
