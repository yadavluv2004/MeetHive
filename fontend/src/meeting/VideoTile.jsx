import { memo, useEffect, useRef } from "react";
import MicOffIcon from "@mui/icons-material/MicOff";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import { useAudioLevel } from "./hooks";
import { avatarColor, initials } from "../utils/meetingCode";

function VideoTile({ id, name, stream, audioOn, videoOn, screen, hand, connection, isSelf, pinned, onPin, sinkId, style, size = "normal" }) {
    const videoRef = useRef(null);
    const videoTrack = stream?.getVideoTracks()[0];
    const audioTrack = stream?.getAudioTracks()[0];
    const level = useAudioLevel(audioTrack, audioOn);
    const speaking = audioOn && level > 0.12;
    const showVideo = !!videoTrack && (videoOn || screen);
    const connecting = !isSelf && connection && !["connected", "completed"].includes(connection);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        if (el.srcObject !== stream) el.srcObject = stream || null;
        if (stream) el.play().catch(() => {});
    }, [stream]);

    useEffect(() => {
        const el = videoRef.current;
        if (!el || isSelf || !sinkId || typeof el.setSinkId !== "function") return;
        el.setSinkId(sinkId).catch(() => {});
    }, [sinkId, isSelf]);

    const label = isSelf ? `${name} (You)` : name;

    return (
        <div
            className={`tile tile-${size} ${speaking ? "speaking" : ""} ${pinned ? "pinned" : ""}`}
            style={style}
            data-id={id}
        >
            {/* Video element stays mounted even with the camera off so remote audio keeps playing */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isSelf}
                className={`${isSelf && !screen ? "mirror" : ""} ${screen ? "contain" : ""} ${showVideo ? "" : "hidden-video"}`}
            />

            {!showVideo && (
                <div className="tile-avatar-wrap">
                    <div
                        className="tile-avatar"
                        style={{
                            background: avatarColor(name),
                            boxShadow: speaking ? `0 0 0 ${4 + level * 14}px rgb(var(--accent-rgb) / 0.4)` : "none",
                        }}
                    >
                        {initials(name)}
                    </div>
                </div>
            )}

            {connecting && (
                <div className="tile-overlay">
                    <span className="spinner spinner-sm" />
                    {connection === "failed" ? "Reconnecting…" : "Connecting…"}
                </div>
            )}

            <div className="tile-top">
                {hand && <span className="tile-badge hand" title="Hand raised">✋</span>}
                {screen && (
                    <span className="tile-badge" title="Presenting">
                        <PresentToAllIcon style={{ fontSize: 16 }} />
                    </span>
                )}
            </div>

            <div className="tile-bottom">
                <span className="tile-name">
                    {!audioOn && <MicOffIcon className="tile-muted" style={{ fontSize: 16 }} />}
                    {speaking && <span className="eq"><i /><i /><i /></span>}
                    <span className="tile-name-text">{screen ? `${label} · presenting` : label}</span>
                </span>
            </div>

            {onPin && (
                <button className="tile-pin" onClick={() => onPin(id)} title={pinned ? "Unpin" : "Pin to main view"}>
                    {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
                </button>
            )}
        </div>
    );
}

export default memo(VideoTile);
