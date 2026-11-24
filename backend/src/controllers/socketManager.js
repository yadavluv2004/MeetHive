import { Server } from "socket.io";

const ROOM_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_ROOM_SIZE = Number(process.env.MAX_ROOM_SIZE) || 12; // mesh topology - keep it modest
const MAX_HISTORY = 200;
const MAX_MESSAGE_LENGTH = 1000;
const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🎉", "👏", "🔥", "🙌", "💯"]);

/**
 * rooms: Map<roomId, { participants: Map<socketId, Participant>, messages: Message[] }>
 * Participant: { id, name, audio, video, screen, hand, joinedAt }
 * clientIds: Map<socketId, clientId> - stable per-browser-session id used to detect rejoins.
 *
 * Why clientId: when a phone switches Wi-Fi <-> cellular its IP changes, the socket reconnects
 * with a NEW socket id, but the server only notices the old socket is dead after the heartbeat
 * timeout (~20-40s). Without dedupe the same person shows up twice. A rejoin with the same
 * clientId evicts the stale entry immediately.
 */
const rooms = new Map();

/** Number of people currently in each meeting (0 if the meeting has ended / never started). */
export const getLiveCounts = (codes) => {
    const out = {};
    for (const code of codes) out[code] = rooms.get(code)?.participants.size || 0;
    return out;
};

const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);

// Very small token-bucket limiter per socket for chatty events
const makeLimiter = (capacity, refillPerSec) => {
    let tokens = capacity;
    let last = Date.now();
    return () => {
        const now = Date.now();
        tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSec);
        last = now;
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
    };
};

export const connectToSocket = (server, corsOptions) => {
    const io = new Server(server, {
        cors: { origin: corsOptions.origin, methods: ["GET", "POST"], credentials: true },
        pingInterval: 20000,
        pingTimeout: 20000,
        maxHttpBufferSize: 1e6,
    });

    io.on("connection", (socket) => {
        let roomId = null;
        const chatAllowed = makeLimiter(10, 1);
        const signalAllowed = makeLimiter(400, 100);
        const eventAllowed = makeLimiter(20, 4);

        const getRoom = () => (roomId ? rooms.get(roomId) : null);

        const leave = () => {
            const room = getRoom();
            if (!room) return;
            if (!room.participants.has(socket.id)) {
                // already evicted by a rejoin of the same client - nothing to announce
                socket.leave(roomId);
                roomId = null;
                return;
            }
            room.participants.delete(socket.id);
            room.clientIds.delete(socket.id);
            socket.to(roomId).emit("participant-left", socket.id);
            socket.leave(roomId);
            if (room.participants.size === 0) rooms.delete(roomId);
            roomId = null;
        };

        socket.on("join-room", (payload, ack) => {
            const reply = typeof ack === "function" ? ack : () => {};
            const requested = clean(payload?.room, 64);

            if (!ROOM_RE.test(requested)) return reply({ ok: false, error: "Invalid meeting code" });
            if (roomId) leave();

            let room = rooms.get(requested);
            if (!room) {
                room = { participants: new Map(), clientIds: new Map(), messages: [] };
                rooms.set(requested, room);
            }

            // Same browser session rejoining (network switch, reconnect): drop the stale entry first
            const clientId = CLIENT_ID_RE.test(String(payload?.clientId || "")) ? payload.clientId : null;
            if (clientId) {
                for (const [staleId, cid] of room.clientIds) {
                    if (cid !== clientId || staleId === socket.id) continue;
                    room.participants.delete(staleId);
                    room.clientIds.delete(staleId);
                    io.to(requested).emit("participant-left", staleId);
                    const stale = io.sockets.sockets.get(staleId);
                    if (stale) {
                        stale.leave(requested);
                        stale.emit("replaced");
                        stale.disconnect(true);
                    }
                }
            }

            if (room.participants.size >= MAX_ROOM_SIZE) {
                return reply({ ok: false, error: `This meeting is full (max ${MAX_ROOM_SIZE} people)` });
            }

            const participant = {
                id: socket.id,
                name: clean(payload?.name, 40) || "Guest",
                audio: !!payload?.audio,
                video: !!payload?.video,
                screen: false,
                hand: false,
                joinedAt: Date.now(),
            };

            const existing = [...room.participants.values()];
            room.participants.set(socket.id, participant);
            if (clientId) room.clientIds.set(socket.id, clientId);
            roomId = requested;
            socket.join(roomId);

            socket.to(roomId).emit("participant-joined", participant);
            reply({ ok: true, self: participant, participants: existing, messages: room.messages });
        });

        socket.on("signal", (payload) => {
            if (!signalAllowed()) return;
            const room = getRoom();
            const to = payload?.to;
            // Only relay between participants of the same meeting
            if (!room || typeof to !== "string" || !room.participants.has(to)) return;
            io.to(to).emit("signal", { from: socket.id, data: payload.data });
        });

        socket.on("media-state", (payload) => {
            if (!eventAllowed()) return;
            const room = getRoom();
            const me = room?.participants.get(socket.id);
            if (!me) return;
            if (typeof payload?.audio === "boolean") me.audio = payload.audio;
            if (typeof payload?.video === "boolean") me.video = payload.video;
            if (typeof payload?.screen === "boolean") me.screen = payload.screen;
            if (typeof payload?.hand === "boolean") me.hand = payload.hand;
            io.to(roomId).emit("participant-updated", me);
        });

        socket.on("chat-message", (payload) => {
            const room = getRoom();
            const me = room?.participants.get(socket.id);
            if (!me) return;
            if (!chatAllowed()) {
                socket.emit("error-message", "You're sending messages too fast");
                return;
            }
            const text = clean(payload?.text, MAX_MESSAGE_LENGTH);
            if (!text) return;

            const message = { id: `${Date.now()}-${socket.id}`, from: socket.id, name: me.name, text, ts: Date.now() };
            room.messages.push(message);
            if (room.messages.length > MAX_HISTORY) room.messages.shift();
            io.to(roomId).emit("chat-message", message);
        });

        socket.on("reaction", (emoji) => {
            if (!eventAllowed()) return;
            const room = getRoom();
            const me = room?.participants.get(socket.id);
            if (!me || !ALLOWED_REACTIONS.has(emoji)) return;
            io.to(roomId).emit("reaction", { from: socket.id, name: me.name, emoji, id: `${Date.now()}-${socket.id}` });
        });

        socket.on("leave-room", leave);
        socket.on("disconnect", leave);
    });

    return io;
};
