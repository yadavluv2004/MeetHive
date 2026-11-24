import { useNavigate } from "react-router-dom";

/**
 * Shows "Rejoin" only while someone is still in the meeting.
 * count: number of people in the meeting, undefined while loading,
 *        or null if live status is unavailable (falls back to a plain Rejoin button).
 */
export default function RejoinButton({ code, count }) {
    const navigate = useNavigate();

    if (count === null) {
        return (
            <button className="btn btn-outline" onClick={() => navigate(`/meet/${code}`)}>
                Rejoin
            </button>
        );
    }
    if (count === undefined) {
        return <span className="meeting-status muted">Checking…</span>;
    }
    if (count === 0) {
        return <span className="meeting-status ended">Ended</span>;
    }
    return (
        <div className="rejoin-wrap">
            <span className="meeting-status live">
                <span className="live-dot" aria-hidden="true" />
                {count} in call
            </span>
            <button className="btn btn-outline" onClick={() => navigate(`/meet/${code}`)}>
                Rejoin
            </button>
        </div>
    );
}
