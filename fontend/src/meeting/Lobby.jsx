import { useMemo, useState } from "react";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import WallpaperOutlinedIcon from "@mui/icons-material/WallpaperOutlined";
import Logo from "../components/Logo";
import UserMenu from "../components/UserMenu";
import ThemeSwitcher from "../components/ThemeSwitcher";
import DeviceSettings from "./DeviceSettings";
import BackgroundPicker from "./BackgroundPicker";
import { useAudioLevel } from "./hooks";
import { useAuth } from "../contexts/AuthContext";
import { avatarColor, initials } from "../utils/meetingCode";

export default function Lobby({ code, media, background, wallpaper, name, setName, onJoin, onCopyLink, joining }) {
    const { isAuthenticated, user } = useAuth();
    const [showSettings, setShowSettings] = useState(false);
    const [pickerTab, setPickerTab] = useState(null); // null | "wallpaper" | "camera"
    const level = useAudioLevel(media.audioTrack, media.audioOn);

    const previewStream = useMemo(
        () => (media.videoTrack ? new MediaStream([media.videoTrack]) : null),
        [media.videoTrack]
    );

    const insecure = !window.isSecureContext;
    const canJoin = name.trim().length > 0 && !joining;

    return (
        <div className={`lobby ${wallpaper.image ? "has-wallpaper" : ""}`} style={wallpaper.style}>
            <header className="site-nav lobby-nav">
                <Logo />
                <div className="site-nav-links">
                    <button className="btn btn-outline btn-customize" onClick={() => setPickerTab("wallpaper")} title="Change lobby wallpaper">
                        <WallpaperOutlinedIcon fontSize="small" />
                        <span className="hide-sm">Customize</span>
                    </button>
                    <ThemeSwitcher />
                    {isAuthenticated && <UserMenu />}
                </div>
            </header>

            <main className="lobby-main">
                <section className="lobby-preview">
                    <div className="preview-frame">
                        {previewStream && media.videoOn ? (
                            <video ref={(el) => { if (el && el.srcObject !== previewStream) el.srcObject = previewStream; }} autoPlay playsInline muted className="mirror" />
                        ) : (
                            <div className="preview-off">
                                {media.ready ? (
                                    <>
                                        <div className="tile-avatar" style={{ background: avatarColor(name || "Guest") }}>
                                            {initials(name || "Guest")}
                                        </div>
                                        <span>Camera is off</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="spinner" />
                                        <span>Starting camera…</span>
                                    </>
                                )}
                            </div>
                        )}

                        {media.audioOn && (
                            <div className="preview-level" aria-hidden="true">
                                {[0.08, 0.2, 0.35].map((t) => (
                                    <i key={t} className={level > t ? "on" : ""} />
                                ))}
                            </div>
                        )}

                        <div className="preview-name">{name || "You"}</div>

                        <div className="preview-controls">
                            <button
                                className={`round-btn ${media.audioOn ? "" : "off"}`}
                                onClick={media.toggleAudio}
                                aria-label={media.audioOn ? "Turn off microphone" : "Turn on microphone"}
                                title={media.audioOn ? "Turn off microphone" : "Turn on microphone"}
                            >
                                {media.audioOn ? <MicIcon /> : <MicOffIcon />}
                            </button>
                            <button
                                className={`round-btn ${media.videoOn ? "" : "off"}`}
                                onClick={media.toggleVideo}
                                aria-label={media.videoOn ? "Turn off camera" : "Turn on camera"}
                                title={media.videoOn ? "Turn off camera" : "Turn on camera"}
                            >
                                {media.videoOn ? <VideocamIcon /> : <VideocamOffIcon />}
                            </button>
                        </div>
                        <button
                            className={`preview-effects ${background.effectId !== "none" ? "active" : ""}`}
                            onClick={() => setPickerTab("camera")}
                            title="Backgrounds & effects"
                            aria-label="Backgrounds and effects"
                        >
                            <AutoAwesomeOutlinedIcon fontSize="small" />
                            <span>Backgrounds</span>
                            {background.status === "loading" && <span className="spinner spinner-sm" />}
                        </button>
                        <button className="preview-settings" onClick={() => setShowSettings(true)} title="Settings" aria-label="Audio and video settings">
                            <SettingsOutlinedIcon />
                        </button>
                    </div>

                    {media.error && (
                        <div className="alert alert-warn lobby-alert">
                            <ErrorOutlineIcon fontSize="small" />
                            <span>{media.error}</span>
                        </div>
                    )}
                    {insecure && !media.error && (
                        <div className="alert alert-warn lobby-alert">
                            <ErrorOutlineIcon fontSize="small" />
                            <span>This page isn't served over HTTPS, so browsers will block the camera and mic for other devices.</span>
                        </div>
                    )}
                </section>

                <section className="lobby-join">
                    <h1>Ready to join?</h1>
                    <div className="lobby-code">
                        <span>{code}</span>
                        <button className="icon-btn" onClick={onCopyLink} title="Copy meeting link" aria-label="Copy meeting link">
                            <ContentCopyIcon fontSize="small" />
                        </button>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (canJoin) onJoin();
                        }}
                    >
                        <div className="field">
                            <label htmlFor="display-name">Your name</label>
                            <input
                                id="display-name"
                                className="input"
                                value={name}
                                maxLength={40}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="What should we call you?"
                                autoFocus={!name}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!canJoin}>
                            {joining && <span className="spinner spinner-sm" />}
                            Join now
                        </button>
                    </form>

                    <p className="lobby-hint">
                        {isAuthenticated
                            ? `Signed in as ${user?.name || "you"}. This meeting will be saved to your history.`
                            : "Joining as a guest. Sign in to keep a history of your meetings."}
                    </p>
                    <p className="lobby-hint hide-sm">
                        Shortcuts: <kbd>Ctrl</kbd>+<kbd>D</kbd> mic · <kbd>Ctrl</kbd>+<kbd>E</kbd> camera
                    </p>
                </section>
            </main>

            {showSettings && <DeviceSettings media={media} onClose={() => setShowSettings(false)} />}
            {pickerTab && (
                <BackgroundPicker
                    background={background}
                    wallpaper={wallpaper}
                    cameraOn={media.videoOn}
                    initialTab={pickerTab}
                    onClose={() => setPickerTab(null)}
                />
            )}
        </div>
    );
}
