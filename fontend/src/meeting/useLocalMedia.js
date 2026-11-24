import { useCallback, useEffect, useRef, useState } from "react";

const PREFS_KEY = "meethive:media-prefs";

const readPrefs = () => {
    try {
        return { audioOn: true, videoOn: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
    } catch {
        return { audioOn: true, videoOn: true };
    }
};

const savePrefs = (patch) => {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
    } catch {
        /* ignore */
    }
};

const audioConstraints = (deviceId) => ({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
});

const videoConstraints = (deviceId) => ({
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
});

export const describeMediaError = (err) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
        return "Camera and microphone need a secure (HTTPS) connection. Open MeetHive over https:// or localhost.";
    }
    switch (err?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
            return "Camera/microphone access was blocked. Click the camera icon in your browser's address bar to allow it, then try again.";
        case "NotFoundError":
        case "DevicesNotFoundError":
            return "No camera or microphone was found on this device.";
        case "NotReadableError":
        case "TrackStartError":
            return "Your camera or microphone is being used by another app. Close it and try again.";
        case "OverconstrainedError":
            return "The selected device isn't available. Try choosing another one in settings.";
        default:
            return "Couldn't access your camera or microphone.";
    }
};

/**
 * Owns the local microphone + camera tracks.
 * - Mic mute uses track.enabled (instant, no renegotiation).
 * - Camera off fully stops the track so the hardware light turns off.
 */
export default function useLocalMedia(active) {
    const prefs = useRef(readPrefs());
    const [audioTrack, setAudioTrack] = useState(null);
    const [videoTrack, setVideoTrack] = useState(null);
    const [audioOn, setAudioOn] = useState(prefs.current.audioOn);
    const [videoOn, setVideoOn] = useState(prefs.current.videoOn);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(null);
    const [devices, setDevices] = useState({ audioinput: [], videoinput: [], audiooutput: [] });
    const [audioDeviceId, setAudioDeviceId] = useState(prefs.current.audioDeviceId || "");
    const [videoDeviceId, setVideoDeviceId] = useState(prefs.current.videoDeviceId || "");
    const [outputDeviceId, setOutputDeviceId] = useState(prefs.current.outputDeviceId || "");

    const tracks = useRef({ audio: null, video: null });
    const audioOnRef = useRef(audioOn);
    audioOnRef.current = audioOn;

    const refreshDevices = useCallback(async () => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const list = await navigator.mediaDevices.enumerateDevices();
        const group = { audioinput: [], videoinput: [], audiooutput: [] };
        list.forEach((d) => d.deviceId && group[d.kind]?.push(d));
        setDevices(group);
    }, []);

    const setTrack = useCallback((kind, track) => {
        const old = tracks.current[kind];
        if (old && old !== track) old.stop();
        tracks.current[kind] = track;
        if (kind === "audio") setAudioTrack(track);
        else setVideoTrack(track);
    }, []);

    const watchEnded = useCallback(
        (kind, track) => {
            track.onended = () => {
                if (tracks.current[kind] !== track) return;
                setTrack(kind, null);
                if (kind === "video") setVideoOn(false);
            };
        },
        [setTrack]
    );

    const acquire = useCallback(
        async (kind, deviceId) => {
            const constraints =
                kind === "audio" ? { audio: audioConstraints(deviceId) } : { video: videoConstraints(deviceId) };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
            if (kind === "audio") track.enabled = audioOnRef.current;
            watchEnded(kind, track);
            return track;
        },
        [watchEnded]
    );

    // Acquire devices when activated, release everything when deactivated / unmounted
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        setReady(false);
        setError(null);

        (async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setError(describeMediaError());
                setReady(true);
                return;
            }
            const wantVideo = prefs.current.videoOn;
            let audio = null;
            let video = null;
            let lastError = null;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: audioConstraints(prefs.current.audioDeviceId),
                    video: wantVideo ? videoConstraints(prefs.current.videoDeviceId) : false,
                });
                audio = stream.getAudioTracks()[0] || null;
                video = stream.getVideoTracks()[0] || null;
            } catch (e) {
                lastError = e;
                // Fall back to whatever works (e.g. no camera, or saved device unplugged)
                try {
                    audio = (await navigator.mediaDevices.getUserMedia({ audio: audioConstraints() })).getAudioTracks()[0];
                } catch (e2) {
                    lastError = e2;
                }
                if (wantVideo) {
                    try {
                        video = (await navigator.mediaDevices.getUserMedia({ video: videoConstraints() })).getVideoTracks()[0];
                    } catch (e3) {
                        lastError = e3;
                    }
                }
            }

            if (cancelled) {
                audio?.stop();
                video?.stop();
                return;
            }

            if (audio) {
                audio.enabled = audioOnRef.current;
                watchEnded("audio", audio);
            }
            if (video) watchEnded("video", video);
            setTrack("audio", audio);
            setTrack("video", video);
            if (!audio) setAudioOn(false);
            if (!video) setVideoOn(false);
            if (!audio && !video && lastError) setError(describeMediaError(lastError));
            setReady(true);
            refreshDevices().catch(() => {});
        })();

        const onDeviceChange = () => refreshDevices().catch(() => {});
        navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

        return () => {
            cancelled = true;
            navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
            tracks.current.audio?.stop();
            tracks.current.video?.stop();
            tracks.current = { audio: null, video: null };
            setAudioTrack(null);
            setVideoTrack(null);
        };
    }, [active, refreshDevices, setTrack, watchEnded]);

    const toggleAudio = useCallback(async () => {
        const next = !audioOnRef.current;
        if (next && !tracks.current.audio) {
            try {
                setTrack("audio", await acquire("audio", audioDeviceId));
                setError(null);
            } catch (e) {
                setError(describeMediaError(e));
                return false;
            }
        }
        if (tracks.current.audio) tracks.current.audio.enabled = next;
        setAudioOn(next);
        prefs.current.audioOn = next;
        savePrefs({ audioOn: next });
        return true;
    }, [acquire, audioDeviceId, setTrack]);

    const toggleVideo = useCallback(async () => {
        if (tracks.current.video) {
            setTrack("video", null);
            setVideoOn(false);
            prefs.current.videoOn = false;
            savePrefs({ videoOn: false });
            return true;
        }
        try {
            setTrack("video", await acquire("video", videoDeviceId));
            setVideoOn(true);
            setError(null);
            prefs.current.videoOn = true;
            savePrefs({ videoOn: true });
            return true;
        } catch (e) {
            setError(describeMediaError(e));
            return false;
        }
    }, [acquire, setTrack, videoDeviceId]);

    const selectAudioDevice = useCallback(
        async (deviceId) => {
            setAudioDeviceId(deviceId);
            prefs.current.audioDeviceId = deviceId;
            savePrefs({ audioDeviceId: deviceId });
            try {
                setTrack("audio", await acquire("audio", deviceId));
            } catch (e) {
                setError(describeMediaError(e));
            }
        },
        [acquire, setTrack]
    );

    const selectVideoDevice = useCallback(
        async (deviceId) => {
            setVideoDeviceId(deviceId);
            prefs.current.videoDeviceId = deviceId;
            savePrefs({ videoDeviceId: deviceId });
            if (!tracks.current.video) return;
            try {
                setTrack("video", await acquire("video", deviceId));
            } catch (e) {
                setError(describeMediaError(e));
            }
        },
        [acquire, setTrack]
    );

    const selectOutputDevice = useCallback((deviceId) => {
        setOutputDeviceId(deviceId);
        prefs.current.outputDeviceId = deviceId;
        savePrefs({ outputDeviceId: deviceId });
    }, []);

    return {
        audioTrack,
        videoTrack,
        audioOn: audioOn && !!audioTrack,
        videoOn: videoOn && !!videoTrack,
        ready,
        error,
        clearError: () => setError(null),
        devices,
        audioDeviceId,
        videoDeviceId,
        outputDeviceId,
        toggleAudio,
        toggleVideo,
        selectAudioDevice,
        selectVideoDevice,
        selectOutputDevice,
    };
}
