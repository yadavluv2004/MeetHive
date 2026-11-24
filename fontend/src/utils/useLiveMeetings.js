import { useEffect, useState } from "react";
import { api } from "../api/client";

const POLL_MS = 15_000;

/**
 * Returns { [code]: participantCount } for the given meeting codes, refreshed every 15s.
 * Returns null until the first response arrives, or false if status couldn't be loaded.
 */
export const countFor = (status, code) => (status === false ? null : status?.[code]);

export default function useLiveMeetings(codes) {
    const [status, setStatus] = useState(null);
    const key = [...new Set(codes)].sort().join(",");

    useEffect(() => {
        if (!key) {
            setStatus({});
            return undefined;
        }
        let cancelled = false;
        const load = () =>
            api
                .get("/meetings/status", { params: { codes: key } })
                .then(({ data }) => !cancelled && setStatus(data?.status || {}))
                // keep last known state on error; if we never got one, mark as unknown
                .catch(() => !cancelled && setStatus((s) => s ?? false));

        load();
        const t = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(t);
        };
    }, [key]);

    return status;
}
