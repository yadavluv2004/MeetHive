import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";
import EmojiEmotionsOutlinedIcon from "@mui/icons-material/EmojiEmotionsOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import CallEndIcon from "@mui/icons-material/CallEnd";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import useMeeting from "./useMeeting";
import VideoTile from "./VideoTile";
import ChatPanel from "./ChatPanel";
import ParticipantsPanel from "./ParticipantsPanel";
import DeviceSettings from "./DeviceSettings";
import BackgroundPicker from "./BackgroundPicker";
import { useBestGrid, useNow } from "./hooks";
import { useToast } from "../contexts/ToastContext";
import { formatDuration } from "../utils/format";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉", "👏", "🔥", "🙌", "💯"];

// Stable pseudo-random values per reaction id, so a floating emoji never jumps
// to a new position when another reaction arrives and the list re-renders.
const hashOf = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
};
const reactionStyle = (id) => {
    const h = hashOf(id);
    return {
        left: `${6 + (h % 70)}%`,
        "--sway": `${14 + ((h >> 8) % 26)}px`,
        "--dur": `${4.2 + ((h >> 16) % 12) / 10}s`,
        "--tilt": `${((h >> 4) % 24) - 12}deg`,
    };
};
const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia;

function ControlButton({ active = true, danger, onClick, label, children, badge, className = "", wide }) {
    return (
        <button
            className={`ctrl ${active ? "" : "off"} ${danger ? "danger" : ""} ${wide ? "wide" : ""} ${className}`}
            onClick={onClick}
            aria-label={label}
            title={label}
        >
            {children}
            {badge ? <span className="ctrl-badge">{badge > 99 ? "99+" : badge}</span> : null}
        </button>
    );
}

export default function Room({ code, name, media, background, wallpaper, onLeave, onCopyLink }) {
    const toast = useToast();
    const [panel, setPanel] = useState(null); // 'chat' | 'people' | null
    const [screenTrack, setScreenTrack] = useState(null);
    const [hand, setHand] = useState(false);
    const [pinnedId, setPinnedId] = useState(null);
    const [showReactions, setShowReactions] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showBackgrounds, setShowBackgrounds] = useState(false);
    const [aloneDismissed, setAloneDismissed] = useState(false);
    const [unread, setUnread] = useState(0);
    const [joinedAt] = useState(Date.now());
    const now = useNow(1000);
    const panelRef = useRef(panel);
    const selfIdRef = useRef(null);
    panelRef.current = panel;

    const outgoingVideo = screenTrack || (media.videoOn ? media.videoTrack : null);

    const onEvent = useCallback(
        (type, payload) => {
            if (type === "joined") toast(`${payload.name} joined`);
            else if (type === "left") toast(`${payload.name} left`);
            else if (type === "hand") toast(`✋ ${payload.name} raised their hand`);
            else if (type === "error") toast(payload, { type: "error" });
            else if (type === "chat" && payload.from !== selfIdRef.current && panelRef.current !== "chat") {
                // Live messages only - history loaded on join doesn't come through this event
                setUnread((n) => n + 1);
                toast(`💬 ${payload.name}: ${payload.text.slice(0, 80)}`);
            }
        },
        [toast]
    );

    const meeting = useMeeting({
        code,
        name,
        audioTrack: media.audioTrack,
        videoTrack: outgoingVideo,
        audioOn: media.audioOn,
        videoOn: media.videoOn,
        screenOn: !!screenTrack,
        hand,
        onEvent,
    });
    selfIdRef.current = meeting.selfId;

    useEffect(() => {
        document.body.classList.add("in-call");
        return () => document.body.classList.remove("in-call");
    }, []);

    useEffect(() => {
        if (!showReactions) return;
        const close = (e) => {
            if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.(".reaction-wrap")) setShowReactions(false);
        };
        document.addEventListener("mousedown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("mousedown", close);
            document.removeEventListener("keydown", close);
        };
    }, [showReactions]);

    useEffect(() => {
        if (panel === "chat") setUnread(0);
    }, [panel]);

    // ----- Screen sharing -----
    // The effect below stops the old track whenever screenTrack changes
    const stopScreen = useCallback(() => setScreenTrack(null), []);

    const startScreen = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 15, max: 30 } },
                audio: false,
            });
            const track = stream.getVideoTracks()[0];
            if ("contentHint" in track) track.contentHint = "detail";
            track.onended = () => setScreenTrack((t) => (t === track ? null : t));
            setScreenTrack(track);
            setPinnedId(null);
        } catch (e) {
            if (e?.name !== "NotAllowedError") toast("Couldn't start screen sharing", { type: "error" });
        }
    };

    useEffect(() => () => screenTrack?.stop(), [screenTrack]);

    // ----- Keyboard shortcuts -----
    const { toggleAudio, toggleVideo } = media;
    useEffect(() => {
        const onKey = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const key = e.key.toLowerCase();
            if (key === "d") {
                e.preventDefault();
                toggleAudio();
            } else if (key === "e") {
                e.preventDefault();
                toggleVideo();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [toggleAudio, toggleVideo]);

    useEffect(() => {
        if (media.error) {
            toast(media.error, { type: "error", duration: 6000 });
            media.clearError();
        }
    }, [media, toast]);

    // ----- Tiles -----
    const selfStream = useMemo(
        () => new MediaStream([media.audioTrack, outgoingVideo].filter(Boolean)),
        [media.audioTrack, outgoingVideo]
    );

    const selfTile = {
        id: meeting.selfId || "self",
        name,
        stream: selfStream,
        audioOn: media.audioOn,
        videoOn: media.videoOn,
        screen: !!screenTrack,
        hand,
        isSelf: true,
    };

    const remoteTiles = meeting.participants.map((p) => ({
        id: p.id,
        name: p.name,
        stream: p.stream,
        audioOn: p.audio,
        videoOn: p.video,
        screen: p.screen,
        hand: p.hand,
        connection: p.connection,
        isSelf: false,
    }));

    const tiles = [selfTile, ...remoteTiles];

    // A pinned participant who left simply stops being pinned
    const activePin = pinnedId && tiles.some((t) => t.id === pinnedId) ? pinnedId : null;

    const presenter = remoteTiles.find((t) => t.screen) || (screenTrack ? selfTile : null);
    const spotlightId = activePin || presenter?.id || null;
    const spotlight = spotlightId ? tiles.find((t) => t.id === spotlightId) : null;
    const others = spotlight ? tiles.filter((t) => t.id !== spotlight.id) : tiles;

    const stageRef = useRef(null);
    const grid = useBestGrid(stageRef, spotlight ? 1 : tiles.length, 12, spotlight ? "spotlight" : "grid");
    const togglePin = useCallback((id) => setPinnedId((cur) => (cur === id ? null : id)), []);

    const people = [
        { ...selfTile, isSelf: true },
        ...remoteTiles,
    ];

    // ----- Render -----
    if (meeting.status === "error") {
        return (
            <div className="room-state">
                <ErrorOutlineIcon style={{ fontSize: 48 }} />
                <h2>Couldn't join the meeting</h2>
                <p>{meeting.error}</p>
                <button className="btn btn-primary" onClick={onLeave}>Go back</button>
            </div>
        );
    }

    const tileProps = (t, size) => ({
        ...t,
        size,
        pinned: activePin === t.id,
        onPin: tiles.length > 1 ? togglePin : undefined,
        sinkId: media.outputDeviceId,
    });

    return (
        <div className={`room ${panel ? "with-panel" : ""} ${wallpaper.image ? "has-wallpaper" : ""}`} style={wallpaper.style}>
            {meeting.status !== "joined" && (
                <div className="room-banner">
                    <span className="spinner spinner-sm" />
                    {meeting.status === "connecting" ? "Joining meeting…" : "Connection lost. Reconnecting…"}
                </div>
            )}

            <div className="room-body">
                <main className={`stage ${spotlight ? "stage-spotlight" : ""}`}>
                    {spotlight ? (
                        <>
                            <div className="spotlight-main" ref={stageRef}>
                                <VideoTile
                                    {...tileProps(spotlight, "large")}
                                    style={{ width: grid.width || "100%", height: grid.height || "100%" }}
                                />
                            </div>
                            {others.length > 0 && (
                                <div className="spotlight-strip">
                                    {others.map((t) => (
                                        <VideoTile key={t.id} {...tileProps(t, "small")} />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="grid-stage" ref={stageRef}>
                            {tiles.map((t) => (
                                <VideoTile
                                    key={t.id}
                                    {...tileProps(t, tiles.length > 6 ? "small" : "normal")}
                                    style={{ width: grid.width, height: grid.height }}
                                />
                            ))}
                        </div>
                    )}

                    {tiles.length === 1 && meeting.status === "joined" && !aloneDismissed && (
                        <div className="alone-card">
                            <button
                                className="alone-close"
                                onClick={() => setAloneDismissed(true)}
                                aria-label="Dismiss"
                                title="Dismiss"
                            >
                                <CloseIcon fontSize="small" />
                            </button>
                            <h3>You're the only one here</h3>
                            <p>Share this link with others you want in the meeting</p>
                            <button className="btn btn-primary" onClick={onCopyLink}>
                                <ContentCopyIcon fontSize="small" /> Copy meeting link
                            </button>
                        </div>
                    )}

                    <div className="reaction-layer" aria-hidden="true">
                        {meeting.reactions.map((r) => (
                            <div key={r.id} className="reaction-float" style={reactionStyle(r.id)}>
                                <div className="reaction-sway">
                                    <span className="reaction-emoji">{r.emoji}</span>
                                    <span className="reaction-name">{r.from === meeting.selfId ? "You" : r.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>

                {panel === "chat" && (
                    <ChatPanel
                        messages={meeting.messages}
                        selfId={meeting.selfId}
                        onSend={meeting.sendMessage}
                        onClose={() => setPanel(null)}
                    />
                )}
                {panel === "people" && (
                    <ParticipantsPanel people={people} code={code} onCopy={onCopyLink} onClose={() => setPanel(null)} />
                )}
            </div>

            <footer className="controls">
                <div className="controls-left">
                    <span className="hide-md">{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="divider hide-md" />
                    <button
                        type="button"
                        className="meeting-code-pill"
                        onClick={onCopyLink}
                        title="Copy meeting link"
                        aria-label={`Meeting code ${code}. Copy meeting link`}
                    >
                        <span className="meeting-code-text">{code}</span>
                        <ContentCopyIcon className="meeting-code-icon" sx={{ fontSize: 15 }} />
                    </button>
                    <span className="duration hide-sm">{formatDuration(now - joinedAt)}</span>
                </div>

                <div className="controls-center">
                    <ControlButton active={media.audioOn} onClick={toggleAudio} label={media.audioOn ? "Mute (Ctrl+D)" : "Unmute (Ctrl+D)"}>
                        {media.audioOn ? <MicIcon /> : <MicOffIcon />}
                    </ControlButton>
                    <ControlButton active={media.videoOn} onClick={toggleVideo} label={media.videoOn ? "Turn off camera (Ctrl+E)" : "Turn on camera (Ctrl+E)"}>
                        {media.videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
                    </ControlButton>
                    {canShareScreen && (
                        <ControlButton
                            className={`hide-sm ${screenTrack ? "highlight" : ""}`}
                            onClick={screenTrack ? stopScreen : startScreen}
                            label={screenTrack ? "Stop presenting" : "Present your screen"}
                        >
                            {screenTrack ? <CancelPresentationIcon /> : <PresentToAllIcon />}
                        </ControlButton>
                    )}
                    <ControlButton className={hand ? "highlight" : ""} onClick={() => setHand((h) => !h)} label={hand ? "Lower hand" : "Raise hand"}>
                        <PanToolOutlinedIcon />
                    </ControlButton>
                    <div className="reaction-wrap">
                        <ControlButton onClick={() => setShowReactions((s) => !s)} label="Send a reaction" className={showReactions ? "highlight" : ""}>
                            <EmojiEmotionsOutlinedIcon />
                        </ControlButton>
                        {showReactions && (
                            <div className="reaction-picker">
                                {REACTIONS.map((emoji) => (
                                    <button
                                        key={emoji}
                                        aria-label={`React ${emoji}`}
                                        onClick={() => meeting.sendReaction(emoji)}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <ControlButton
                        className={background.effectId !== "none" || wallpaper.id !== "theme" ? "highlight" : ""}
                        onClick={() => setShowBackgrounds(true)}
                        label="Backgrounds & effects"
                    >
                        <AutoAwesomeOutlinedIcon />
                    </ControlButton>
                    <ControlButton className="hide-sm" onClick={() => setShowSettings(true)} label="Settings">
                        <SettingsOutlinedIcon />
                    </ControlButton>
                    <ControlButton danger wide onClick={onLeave} label="Leave call">
                        <CallEndIcon />
                    </ControlButton>
                </div>

                <div className="controls-right">
                    <ControlButton
                        className={`flat ${panel === "people" ? "selected" : ""}`}
                        onClick={() => setPanel((p) => (p === "people" ? null : "people"))}
                        label="People"
                        badge={tiles.length}
                    >
                        <PeopleOutlineIcon />
                    </ControlButton>
                    <ControlButton
                        className={`flat ${panel === "chat" ? "selected" : ""}`}
                        onClick={() => setPanel((p) => (p === "chat" ? null : "chat"))}
                        label="Chat with everyone"
                        badge={unread}
                    >
                        <ChatOutlinedIcon />
                    </ControlButton>
                </div>
            </footer>

            {showSettings && <DeviceSettings media={media} onClose={() => setShowSettings(false)} />}
            {showBackgrounds && (
                <BackgroundPicker
                    background={background}
                    wallpaper={wallpaper}
                    cameraOn={media.videoOn}
                    initialTab="camera"
                    onClose={() => setShowBackgrounds(false)}
                />
            )}
        </div>
    );
}
