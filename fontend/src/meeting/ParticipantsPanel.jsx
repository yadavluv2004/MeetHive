import CloseIcon from "@mui/icons-material/Close";
import MicOffIcon from "@mui/icons-material/MicOff";
import MicNoneIcon from "@mui/icons-material/MicNone";
import VideocamOffOutlinedIcon from "@mui/icons-material/VideocamOffOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import { avatarColor, initials, meetingLink } from "../utils/meetingCode";

export default function ParticipantsPanel({ people, code, onCopy, onClose }) {
    const raised = people.filter((p) => p.hand);
    return (
        <aside className="side-panel" aria-label="People">
            <header className="panel-head">
                <h3>People</h3>
                <button className="icon-btn" onClick={onClose} aria-label="Close people panel">
                    <CloseIcon />
                </button>
            </header>

            <div className="invite-box">
                <div className="invite-label">Share this meeting link</div>
                <div className="invite-link">{meetingLink(code)}</div>
                <button className="btn btn-primary btn-block" onClick={onCopy}>
                    <ContentCopyIcon fontSize="small" /> Copy joining info
                </button>
            </div>

            {raised.length > 0 && (
                <>
                    <div className="people-section">Raised hands</div>
                    <ul className="people-list">
                        {raised.map((p) => (
                            <li key={`h-${p.id}`}>
                                <span className="hand-emoji">✋</span>
                                <span className="people-name">{p.isSelf ? `${p.name} (You)` : p.name}</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <div className="people-section">In the meeting · {people.length}</div>
            <ul className="people-list">
                {people.map((p) => (
                    <li key={p.id}>
                        <div className="avatar avatar-sm" style={{ background: avatarColor(p.name) }}>
                            {initials(p.name)}
                        </div>
                        <span className="people-name">
                            {p.name}
                            {p.isSelf && <span className="you-tag"> (You)</span>}
                        </span>
                        <span className="people-icons">
                            {p.screen && <PresentToAllIcon fontSize="small" titleAccess="Presenting" />}
                            {!p.videoOn && <VideocamOffOutlinedIcon fontSize="small" titleAccess="Camera off" />}
                            {p.audioOn ? (
                                <MicNoneIcon fontSize="small" titleAccess="Mic on" />
                            ) : (
                                <MicOffIcon fontSize="small" className="danger" titleAccess="Muted" />
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
