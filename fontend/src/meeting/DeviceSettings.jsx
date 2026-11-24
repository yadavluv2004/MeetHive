import { memo } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MicNoneIcon from "@mui/icons-material/MicNone";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import { useAudioLevel } from "./hooks";
import { ThemeOptions } from "../components/ThemeSwitcher";

const supportsSinkId = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

// memo: the room re-renders every second (clock, speaking indicators). Without this the
// open <select> menus are re-rendered constantly, which makes picking a device feel laggy.
const DeviceSelect = memo(({ icon: Icon, label, devices, value, onChange, emptyText }) => (
    <div className="field">
        <label>
            <Icon fontSize="small" /> {label}
        </label>
        <select className="input select" value={value} onChange={(e) => onChange(e.target.value)} disabled={!devices.length}>
            {!devices.length && <option value="">{emptyText}</option>}
            {devices.length > 0 && <option value="">System default</option>}
            {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `${label} ${i + 1}`}
                </option>
            ))}
        </select>
    </div>
));
DeviceSelect.displayName = "DeviceSelect";

// Own component so the ~8 updates/second from the mic level only re-render the meter bar,
// not the whole settings dialog.
function MicMeter({ track }) {
    const level = useAudioLevel(track, true);
    return (
        <div className="mic-meter" aria-hidden="true">
            <div style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
    );
}

export default function DeviceSettings({ media, onClose }) {
    return (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Audio and video settings">
                <header className="panel-head">
                    <h3>Settings</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close settings">
                        <CloseIcon />
                    </button>
                </header>
                <div className="modal-body">
                    <DeviceSelect
                        icon={MicNoneIcon}
                        label="Microphone"
                        devices={media.devices.audioinput}
                        value={media.audioDeviceId}
                        onChange={media.selectAudioDevice}
                        emptyText="No microphone found"
                    />
                    <MicMeter track={media.audioTrack} />

                    {supportsSinkId && (
                        <DeviceSelect
                            icon={VolumeUpOutlinedIcon}
                            label="Speaker"
                            devices={media.devices.audiooutput}
                            value={media.outputDeviceId}
                            onChange={media.selectOutputDevice}
                            emptyText="Default speaker"
                        />
                    )}

                    <DeviceSelect
                        icon={VideocamOutlinedIcon}
                        label="Camera"
                        devices={media.devices.videoinput}
                        value={media.videoDeviceId}
                        onChange={media.selectVideoDevice}
                        emptyText="No camera found"
                    />

                    <div className="section-label">App theme</div>
                    <ThemeOptions />
                </div>
            </div>
        </div>
    );
}
