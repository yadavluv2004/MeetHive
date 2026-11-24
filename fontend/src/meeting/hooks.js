import { useEffect, useLayoutEffect, useState } from "react";

let sharedCtx = null;
const getAudioContext = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new Ctx();
    if (sharedCtx.state === "suspended") sharedCtx.resume().catch(() => {});
    return sharedCtx;
};

/** Returns a smoothed 0..1 volume level for an audio track (used for speaking indicators and mic meter). */
export function useAudioLevel(track, enabled = true) {
    const [level, setLevel] = useState(0);

    useEffect(() => {
        if (!track || !enabled || track.readyState === "ended") {
            setLevel(0);
            return;
        }
        const ctx = getAudioContext();
        if (!ctx) return;

        let source;
        let analyser;
        try {
            source = ctx.createMediaStreamSource(new MediaStream([track]));
            analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.6;
            source.connect(analyser);
        } catch {
            return;
        }

        const data = new Uint8Array(analyser.fftSize);
        let smoothed = 0;
        const timer = setInterval(() => {
            analyser.getByteTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt(sum / data.length);
            smoothed = Math.max(rms * 4, smoothed * 0.75);
            setLevel((prev) => {
                const next = Math.min(1, smoothed);
                return Math.abs(prev - next) < 0.02 ? prev : next;
            });
        }, 120);

        return () => {
            clearInterval(timer);
            try {
                source.disconnect();
            } catch {
                /* ignore */
            }
        };
    }, [track, enabled]);

    return level;
}

/**
 * Picks the column count that gives the biggest 16:9 tiles for `count` tiles
 * inside the measured container.
 */
export function useBestGrid(ref, count, gap = 12, mode = "grid") {
    const [layout, setLayout] = useState({ cols: 1, width: 0, height: 0 });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const compute = () => {
            const W = el.clientWidth;
            const H = el.clientHeight;
            if (!W || !H || !count) return;
            let best = { cols: 1, width: 0, height: 0 };
            for (let cols = 1; cols <= count; cols++) {
                const rows = Math.ceil(count / cols);
                let w = (W - gap * (cols - 1)) / cols;
                let h = (w * 9) / 16;
                if (h * rows + gap * (rows - 1) > H) {
                    h = (H - gap * (rows - 1)) / rows;
                    w = (h * 16) / 9;
                }
                if (w * h > best.width * best.height) best = { cols, width: Math.floor(w), height: Math.floor(h) };
            }
            setLayout(best);
        };

        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, [ref, count, gap, mode]);

    return layout;
}

export function useNow(intervalMs = 1000) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}
