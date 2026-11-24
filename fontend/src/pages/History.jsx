import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VideoCallOutlinedIcon from "@mui/icons-material/VideoCallOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryIcon from "@mui/icons-material/History";
import Logo from "../components/Logo";
import UserMenu from "../components/UserMenu";
import ThemeSwitcher from "../components/ThemeSwitcher";
import RejoinButton from "../components/RejoinButton";
import useLiveMeetings, { countFor } from "../utils/useLiveMeetings";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { errorMessage } from "../api/client";
import { copyText, meetingLink } from "../utils/meetingCode";
import { formatRelative } from "../utils/format";
import "../App.css";

const groupLabel = (dateLike) => {
    const d = new Date(dateLike);
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return "This week";
    return d.toLocaleDateString([], { month: "long", year: "numeric" });
};

export default function History() {
    const { getHistoryOfUser, deleteHistoryItem } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [meetings, setMeetings] = useState(null);
    const [query, setQuery] = useState("");
    const live = useLiveMeetings((meetings || []).slice(0, 50).map((m) => m.meetingCode));

    useEffect(() => {
        getHistoryOfUser()
            .then(setMeetings)
            .catch((e) => {
                setMeetings([]);
                toast(errorMessage(e, "Couldn't load your history"), { type: "error" });
            });
    }, [getHistoryOfUser, toast]);

    const groups = useMemo(() => {
        const list = (meetings || []).filter((m) => m.meetingCode.toLowerCase().includes(query.trim().toLowerCase()));
        const map = new Map();
        list.forEach((m) => {
            const label = groupLabel(m.date);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(m);
        });
        return [...map.entries()];
    }, [meetings, query]);

    const remove = async (id) => {
        const prev = meetings;
        setMeetings((list) => list.filter((m) => m._id !== id));
        try {
            await deleteHistoryItem(id);
        } catch (e) {
            setMeetings(prev);
            toast(errorMessage(e, "Couldn't delete that entry"), { type: "error" });
        }
    };

    return (
        <div className="app-shell">
            <header className="site-nav">
                <Logo />
                <div className="site-nav-links">
                    <ThemeSwitcher />
                    <UserMenu />
                </div>
            </header>

            <main className="history">
                <div className="history-head">
                    <button className="icon-btn" onClick={() => navigate("/home")} aria-label="Back to home">
                        <ArrowBackIcon />
                    </button>
                    <div>
                        <h1>Meeting history</h1>
                        <p className="muted">{meetings ? `${meetings.length} meetings` : "Loading…"}</p>
                    </div>
                </div>

                <div className="input-icon history-search">
                    <SearchIcon fontSize="small" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by meeting code" />
                </div>

                {meetings === null ? (
                    <div className="recent-list">
                        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
                    </div>
                ) : groups.length === 0 ? (
                    <div className="empty-state">
                        <HistoryIcon />
                        <p>{query ? "No meetings match your search." : "You haven't joined any meetings yet."}</p>
                        {!query && (
                            <button className="btn btn-primary" onClick={() => navigate("/home")}>Start a meeting</button>
                        )}
                    </div>
                ) : (
                    groups.map(([label, items]) => (
                        <section key={label} className="history-group">
                            <h3>{label}</h3>
                            <ul className="recent-list">
                                {items.map((m) => (
                                    <li key={m._id} className="recent-item">
                                        <div className="recent-icon"><VideoCallOutlinedIcon fontSize="small" /></div>
                                        <div className="recent-meta">
                                            <div className="recent-code">{m.meetingCode}</div>
                                            <div className="recent-date">{formatRelative(m.date)}</div>
                                        </div>
                                        <div className="row-actions">
                                            <button
                                                className="icon-btn"
                                                title="Copy invite link"
                                                onClick={async () => {
                                                    await copyText(meetingLink(m.meetingCode));
                                                    toast("Invite link copied", { type: "success" });
                                                }}
                                            >
                                                <ContentCopyIcon fontSize="small" />
                                            </button>
                                            <button className="icon-btn" title="Remove from history" onClick={() => remove(m._id)}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </button>
                                            <RejoinButton code={m.meetingCode} count={countFor(live, m.meetingCode)} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </main>
        </div>
    );
}
