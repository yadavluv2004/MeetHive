import { useEffect, useMemo, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import BlurCircularIcon from "@mui/icons-material/BlurCircular";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import FormatColorFillOutlinedIcon from "@mui/icons-material/FormatColorFillOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CenterFocusStrongOutlinedIcon from "@mui/icons-material/CenterFocusStrongOutlined";
import CropFreeIcon from "@mui/icons-material/CropFree";
import { BACKGROUNDS, CUSTOM_ID, prepareCustomImage, renderScene } from "./backgrounds";
import { preloadSegmenter } from "./backgroundProcessor";
import { WALLPAPERS } from "./useWallpaper";
import { ThemeOptions } from "../components/ThemeSwitcher";

const ICONS = { none: BlockOutlinedIcon, "blur-light": BlurCircularIcon, "blur-strong": BlurOnIcon };

const TABS = [
    { id: "wallpaper", label: "Wallpaper" },
    { id: "camera", label: "Camera background" },
    { id: "theme", label: "Theme" },
];

// Thumbnails are painted once per session, not every time the dialog opens.
let thumbCache = null;
const getThumbnails = () => {
    if (!thumbCache) {
        thumbCache = {};
        BACKGROUNDS.filter((b) => b.type === "scene").forEach((b) => {
            thumbCache[b.id] = renderScene(b, 192, 108).toDataURL("image/jpeg", 0.8);
        });
    }
    return thumbCache;
};
const useThumbnails = () => useMemo(getThumbnails, []);

function Tile({ active, label, onClick, children, icon, className = "" }) {
    return (
        <button
            className={`bg-tile ${active ? "active" : ""} ${icon ? "bg-icon" : ""} ${className}`}
            onClick={onClick}
            title={label}
            aria-pressed={active}
        >
            {children}
            <span className="bg-label">{label}</span>
        </button>
    );
}

function UploadTile({ onFile, label = "Add your own" }) {
    const ref = useRef(null);
    return (
        <>
            <button className="bg-tile bg-icon bg-upload" onClick={() => ref.current?.click()} title="Upload an image">
                <AddPhotoAlternateOutlinedIcon />
                <span className="bg-label">{label}</span>
            </button>
            <input
                ref={ref}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onFile(file);
                }}
            />
        </>
    );
}

/** One dialog for page wallpaper, camera (virtual) background and app theme. */
export default function BackgroundPicker({ background, wallpaper, cameraOn, onClose, initialTab = "wallpaper" }) {
    const thumbs = useThumbnails();
    const [tab, setTab] = useState(initialTab);
    const [error, setError] = useState("");

    useEffect(() => {
        if (tab === "camera") preloadSegmenter();
    }, [tab]);

    const handleUpload = (apply, maxW, maxH) => async (file) => {
        try {
            setError("");
            apply(await prepareCustomImage(file, maxW, maxH));
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="Customize">
                <header className="panel-head">
                    <h3>Customize</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <CloseIcon />
                    </button>
                </header>

                <div className="tabs" role="tablist">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={tab === t.id}
                            className={tab === t.id ? "active" : ""}
                            onClick={() => {
                                setTab(t.id);
                                setError("");
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="modal-body">
                    {error && <div className="alert alert-error">{error}</div>}

                    {tab === "wallpaper" && (
                        <>
                            <p className="tab-hint">The background behind your lobby and meeting screen. Only you see it.</p>
                            <div className="bg-grid">
                                <Tile
                                    icon
                                    active={wallpaper.id === "theme"}
                                    label="Theme colour"
                                    onClick={() => wallpaper.select("theme")}
                                >
                                    <FormatColorFillOutlinedIcon />
                                </Tile>
                                {wallpaper.customSrc && (
                                    <Tile
                                        active={wallpaper.id === "custom"}
                                        label="Your image"
                                        onClick={() => wallpaper.select("custom")}
                                        className="has-remove"
                                    >
                                        <img src={wallpaper.customSrc} alt="" />
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="bg-remove"
                                            title="Remove your image"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                wallpaper.removeCustomImage();
                                            }}
                                        >
                                            <DeleteOutlineIcon style={{ fontSize: 16 }} />
                                        </span>
                                    </Tile>
                                )}
                                {WALLPAPERS.map((b) => (
                                    <Tile key={b.id} active={wallpaper.id === b.id} label={b.label} onClick={() => wallpaper.select(b.id)}>
                                        <img src={thumbs[b.id]} alt="" />
                                    </Tile>
                                ))}
                                <UploadTile onFile={handleUpload(wallpaper.setCustomImage, 1920, 1080)} />
                            </div>
                        </>
                    )}

                    {tab === "camera" && (
                        <>
                            <p className="tab-hint">Replaces what's behind you on camera. Everyone in the call sees it.</p>
                            {!cameraOn && <div className="alert alert-warn">Turn on your camera to see the effect.</div>}
                            {background.status === "loading" && (
                                <div className="bg-status">
                                    <span className="spinner spinner-sm" /> Preparing camera effect…
                                </div>
                            )}
                            {background.status === "error" && (
                                <div className="alert alert-error">
                                    Camera effects couldn't load on this device or network. Your normal camera is being used.
                                </div>
                            )}

                            <div className="section-label">Framing</div>
                            <div className="bg-grid">
                                <Tile icon active={!background.autoFrame} label="Off" onClick={() => background.setAutoFrame(false)}>
                                    <CropFreeIcon />
                                </Tile>
                                <Tile
                                    icon
                                    active={background.autoFrame}
                                    label="Auto-frame"
                                    onClick={() => background.setAutoFrame(true)}
                                >
                                    <CenterFocusStrongOutlinedIcon />
                                </Tile>
                            </div>

                            <div className="section-label">Blur</div>
                            <div className="bg-grid">
                                {BACKGROUNDS.filter((b) => b.type === "none" || b.type === "blur").map((b) => {
                                    const Icon = ICONS[b.id];
                                    return (
                                        <Tile key={b.id} icon active={background.effectId === b.id} label={b.label} onClick={() => background.select(b.id)}>
                                            <Icon />
                                        </Tile>
                                    );
                                })}
                            </div>

                            <div className="section-label">Backgrounds</div>
                            <div className="bg-grid">
                                {background.customSrc && (
                                    <Tile active={background.effectId === CUSTOM_ID} label="Your image" onClick={() => background.select(CUSTOM_ID)}>
                                        <img src={background.customSrc} alt="" />
                                    </Tile>
                                )}
                                {BACKGROUNDS.filter((b) => b.type === "scene").map((b) => (
                                    <Tile key={b.id} active={background.effectId === b.id} label={b.label} onClick={() => background.select(b.id)}>
                                        <img src={thumbs[b.id]} alt="" />
                                    </Tile>
                                ))}
                                <UploadTile onFile={handleUpload(background.setCustomImage, 1280, 720)} label="Upload" />
                            </div>
                        </>
                    )}

                    {tab === "theme" && (
                        <>
                            <p className="tab-hint">Colours used across the whole app.</p>
                            <ThemeOptions />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
