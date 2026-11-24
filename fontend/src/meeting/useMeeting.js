import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "../config";
import { fetchIceServers } from "../api/client";

/*
 * Signaling model
 * ---------------
 * - The participant who JOINS creates an offer to every participant already in the room
 *   ("initiator"). Existing participants only answer. One side always offers -> no glare.
 * - Every connection has exactly one audio + one video transceiver. Toggling the camera,
 *   switching devices or screen sharing is done with sender.replaceTrack(): no renegotiation.
 * - ICE candidates that arrive before the remote description are queued.
 * - If a connection fails (network change, Wi-Fi -> 4G, ...) the initiator performs an ICE restart.
 * - TURN servers come from the backend (/api/v1/ice-servers) so calls work across NATs/firewalls.
 */

const bitrateFor = (peerCount, screen) => {
    const base = peerCount <= 1 ? 1_500_000 : peerCount <= 3 ? 900_000 : peerCount <= 6 ? 500_000 : 300_000;
    return screen ? Math.max(base, 1_200_000) : base;
};

const applyLocalTracks = (peer, { audioTrack, videoTrack }) => {
    peer.audioSender?.replaceTrack(audioTrack || null).catch(() => {});
    peer.videoSender?.replaceTrack(videoTrack || null).catch(() => {});
};

const tuneBitrate = (peers, screen) => {
    const max = bitrateFor(peers.size, screen);
    peers.forEach((peer) => {
        const sender = peer.videoSender;
        if (!sender?.getParameters) return;
        const params = sender.getParameters();
        if (!params.encodings || !params.encodings.length) return;
        if (params.encodings[0].maxBitrate === max) return;
        params.encodings[0].maxBitrate = max;
        sender.setParameters(params).catch(() => {});
    });
};

export default function useMeeting({ code, name, audioTrack, videoTrack, audioOn, videoOn, screenOn, hand, onEvent }) {
    const [status, setStatus] = useState("connecting"); // connecting | joined | reconnecting | error
    const [error, setError] = useState(null);
    const [selfId, setSelfId] = useState(null);
    const [participantMap, setParticipantMap] = useState({});
    const [messages, setMessages] = useState([]);
    const [reactions, setReactions] = useState([]);

    const socketRef = useRef(null);
    const peersRef = useRef(new Map());
    const iceRef = useRef(null);
    const localRef = useRef({ audioTrack, videoTrack });
    const stateRef = useRef({});
    const onEventRef = useRef(onEvent);
    const joinedRef = useRef(false);
    const mapRef = useRef(participantMap);

    mapRef.current = participantMap;
    stateRef.current = { name, audioOn, videoOn, screenOn, hand };
    onEventRef.current = onEvent;

    useEffect(() => {
        let disposed = false;
        let socket = null;
        const peers = peersRef.current;
        const emitEvent = (type, payload) => onEventRef.current?.(type, payload);

        const updateParticipant = (id, patch) =>
            setParticipantMap((map) => (map[id] ? { ...map, [id]: { ...map[id], ...patch } } : map));

        const send = (to, data) => socket?.emit("signal", { to, data });

        const closePeer = (id) => {
            const peer = peers.get(id);
            if (!peer) return;
            clearTimeout(peer.disconnectTimer);
            peer.pc.onicecandidate = null;
            peer.pc.ontrack = null;
            peer.pc.onconnectionstatechange = null;
            peer.pc.close();
            peers.delete(id);
        };

        const closeAllPeers = () => [...peers.keys()].forEach(closePeer);

        const makeOffer = async (peer, iceRestart = false) => {
            if (peer.pc.signalingState === "closed") return;
            const offer = await peer.pc.createOffer({ iceRestart });
            await peer.pc.setLocalDescription(offer);
            send(peer.id, { description: peer.pc.localDescription.toJSON() });
        };

        const restartIce = (peer) => {
            if (disposed || peers.get(peer.id) !== peer || !peer.initiator) return;
            if (peer.restarts >= 5) return;
            peer.restarts += 1;
            peer.queue = peer.queue.then(() => makeOffer(peer, true)).catch((e) => console.warn("ICE restart failed", e));
        };

        const createPeer = (id, initiator) => {
            const pc = new RTCPeerConnection({ iceServers: iceRef.current, iceCandidatePoolSize: 2 });
            const peer = {
                id,
                pc,
                initiator,
                stream: new MediaStream(),
                pending: [],
                queue: Promise.resolve(),
                audioSender: null,
                videoSender: null,
                disconnectTimer: null,
                restarts: 0,
            };
            peers.set(id, peer);

            if (initiator) {
                peer.audioSender = pc.addTransceiver("audio", { direction: "sendrecv" }).sender;
                peer.videoSender = pc.addTransceiver("video", { direction: "sendrecv" }).sender;
                applyLocalTracks(peer, localRef.current);
            }

            pc.onicecandidate = (e) => {
                if (e.candidate) send(id, { candidate: e.candidate.toJSON() });
            };

            pc.ontrack = (e) => {
                const others = peer.stream.getTracks().filter((t) => t.kind !== e.track.kind);
                peer.stream = new MediaStream([...others, e.track]);
                updateParticipant(id, { stream: peer.stream });
            };

            pc.onconnectionstatechange = () => {
                const state = pc.connectionState;
                updateParticipant(id, { connection: state });
                clearTimeout(peer.disconnectTimer);
                if (state === "connected") {
                    peer.restarts = 0;
                    tuneBitrate(peers, stateRef.current.screenOn);
                } else if (state === "failed") {
                    restartIce(peer);
                } else if (state === "disconnected") {
                    peer.disconnectTimer = setTimeout(() => restartIce(peer), 4000);
                }
            };

            return peer;
        };

        const handleSignal = ({ from, data }) => {
            if (!data) return;
            let peer = peers.get(from);
            if (!peer) {
                if (data.description?.type !== "offer") return; // stale message for a closed peer
                peer = createPeer(from, false);
            }
            const { pc } = peer;

            // Serialise per-peer signaling so async steps never interleave
            peer.queue = peer.queue
                .then(async () => {
                    if (pc.signalingState === "closed") return;
                    if (data.description) {
                        await pc.setRemoteDescription(data.description);
                        for (const c of peer.pending.splice(0)) await pc.addIceCandidate(c).catch(() => {});

                        if (data.description.type === "offer") {
                            if (!peer.audioSender) {
                                pc.getTransceivers().forEach((t) => {
                                    const kind = t.receiver.track?.kind;
                                    t.direction = "sendrecv";
                                    if (kind === "audio" && !peer.audioSender) peer.audioSender = t.sender;
                                    if (kind === "video" && !peer.videoSender) peer.videoSender = t.sender;
                                });
                                applyLocalTracks(peer, localRef.current);
                            }
                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);
                            send(from, { description: pc.localDescription.toJSON() });
                        }
                    } else if (data.candidate) {
                        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(() => {});
                        else peer.pending.push(data.candidate);
                    }
                })
                .catch((e) => console.warn("Signaling error with", from, e));
        };

        const join = () => {
            const s = stateRef.current;
            socket.emit("join-room", { room: code, name: s.name, audio: s.audioOn, video: s.videoOn }, (res) => {
                if (disposed) return;
                if (!res?.ok) {
                    setStatus("error");
                    setError(res?.error || "Couldn't join the meeting");
                    socket.disconnect();
                    return;
                }
                joinedRef.current = true;
                setSelfId(res.self.id);
                setMessages(res.messages || []);
                const map = {};
                res.participants.forEach((p) => {
                    map[p.id] = { ...p, stream: null, connection: "new" };
                });
                setParticipantMap(map);
                setStatus("joined");
                setError(null);

                res.participants.forEach((p) => {
                    const peer = createPeer(p.id, true);
                    peer.queue = peer.queue.then(() => makeOffer(peer)).catch((e) => console.warn("Offer failed", e));
                });

                const latest = stateRef.current;
                socket.emit("media-state", {
                    audio: latest.audioOn,
                    video: latest.videoOn,
                    screen: latest.screenOn,
                    hand: latest.hand,
                });
            });
        };

        (async () => {
            iceRef.current = await fetchIceServers();
            if (disposed) return;

            socket = io(SERVER_URL, { reconnectionDelayMax: 5000, timeout: 10000 });
            socketRef.current = socket;

            socket.on("connect", () => {
                // Fresh socket id (first connect or reconnect) -> rebuild everything from scratch
                closeAllPeers();
                setParticipantMap({});
                join();
            });

            socket.on("disconnect", (reason) => {
                joinedRef.current = false;
                if (reason !== "io client disconnect") setStatus("reconnecting");
            });

            socket.on("connect_error", () => {
                if (!disposed) setStatus((s) => (s === "error" ? s : "reconnecting"));
            });

            socket.on("participant-joined", (p) => {
                setParticipantMap((map) => ({ ...map, [p.id]: { ...p, stream: null, connection: "new" } }));
                emitEvent("joined", p);
            });

            socket.on("participant-left", (id) => {
                closePeer(id);
                const leaving = mapRef.current[id];
                if (leaving) emitEvent("left", leaving);
                setParticipantMap((map) => {
                    if (!map[id]) return map;
                    const rest = { ...map };
                    delete rest[id];
                    return rest;
                });
                tuneBitrate(peers, stateRef.current.screenOn);
            });

            socket.on("participant-updated", (p) => {
                if (p.id === socket.id) return;
                const prev = mapRef.current[p.id];
                if (prev && p.hand && !prev.hand) emitEvent("hand", p);
                setParticipantMap((map) => (map[p.id] ? { ...map, [p.id]: { ...map[p.id], ...p } } : map));
            });

            socket.on("signal", handleSignal);

            socket.on("chat-message", (m) => {
                setMessages((list) => [...list.slice(-199), m]);
                emitEvent("chat", m);
            });

            socket.on("reaction", (r) => {
                setReactions((list) => [...list.slice(-30), r]);
                setTimeout(() => setReactions((list) => list.filter((x) => x.id !== r.id)), 5500);
            });

            socket.on("error-message", (msg) => emitEvent("error", msg));
        })();

        return () => {
            disposed = true;
            joinedRef.current = false;
            if (socket) {
                socket.emit("leave-room");
                socket.removeAllListeners();
                socket.disconnect();
            }
            socketRef.current = null;
            closeAllPeers();
        };
    }, [code]);

    // Push new local tracks (mute/camera/device switch/screen share) to every peer
    useEffect(() => {
        localRef.current = { audioTrack, videoTrack };
        peersRef.current.forEach((peer) => applyLocalTracks(peer, localRef.current));
    }, [audioTrack, videoTrack]);

    // Broadcast UI state (mic/camera/screen/hand) to others
    useEffect(() => {
        if (!joinedRef.current) return;
        socketRef.current?.emit("media-state", { audio: audioOn, video: videoOn, screen: screenOn, hand });
    }, [audioOn, videoOn, screenOn, hand]);

    useEffect(() => {
        tuneBitrate(peersRef.current, screenOn);
    }, [screenOn]);

    const sendMessage = useCallback((text) => {
        const value = text.trim();
        if (!value || !socketRef.current?.connected) return false;
        socketRef.current.emit("chat-message", { text: value });
        return true;
    }, []);

    const sendReaction = useCallback((emoji) => {
        socketRef.current?.emit("reaction", emoji);
    }, []);

    const participants = useMemo(
        () => Object.values(participantMap).sort((a, b) => a.joinedAt - b.joinedAt),
        [participantMap]
    );

    return { status, error, selfId, participants, messages, reactions, sendMessage, sendReaction };
}
