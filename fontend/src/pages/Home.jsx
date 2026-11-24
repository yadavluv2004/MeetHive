import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VideoCallOutlinedIcon from "@mui/icons-material/VideoCallOutlined";
import LinkIcon from "@mui/icons-material/Link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Logo from "../components/Logo";
import UserMenu from "../components/UserMenu";
import ThemeSwitcher from "../components/ThemeSwitcher";
import JoinForm from "../components/JoinForm";
import RejoinButton from "../components/RejoinButton";
import useLiveMeetings, { countFor } from "../utils/useLiveMeetings";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { copyText, generateMeetingCode, meetingLink } from "../utils/meetingCode";
import { formatRelative } from "../utils/format";
import "../App.css";

const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
};

export default function Home() {
    const navigate = useNavigate();
    const toast = useToast();
    const { user, getHistoryOfUser } = useAuth();
    const [recent, setRecent] = useState(null);
    const [now, setNow] = useState(new Date());
    const live = useLiveMeetings((recent || []).map((m) => m.meetingCode));

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        getHistoryOfUser()
            .then((list) => {
                // De-duplicate by code, newest first
                const seen = new Set();
                setRecent(list.filter((m) => !seen.has(m.meetingCode) && seen.add(m.meetingCode)).slice(0, 5));
            })
            .catch(() => setRecent([]));
    }, [getHistoryOfUser]);

    const startNow = () => navigate(`/meet/${generateMeetingCode()}`);

    const createForLater = async () => {
        const code = generateMeetingCode();
        await copyText(meetingLink(code));
        toast(`Meeting link copied: ${code}`, { type: "success" });
    };

    const firstName = user?.name?.split(" ")[0];

    return (
        <div className="app-shell">
            <header className="site-nav">
                <Logo />
                <div className="site-nav-links">
                    <span className="nav-clock hide-sm">
                        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                        {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <ThemeSwitcher />
                    <UserMenu />
                </div>
            </header>

            <main className="home">
                <section className="home-hero">
                    <h1>
                        {greeting()}{firstName ? `, ${firstName}` : ""} 👋
                    </h1>
                    <p className="lead">Start an instant meeting or join one with a code.</p>

                    <div className="home-actions">
                        <button className="action-card action-primary" onClick={startNow}>
                            <div className="action-icon"><VideoCallOutlinedIcon /></div>
                            <div>
                                <h3>New meeting</h3>
                                <p>Start an instant meeting</p>
                            </div>
                        </button>
                        <button className="action-card" onClick={createForLater}>
                            <div className="action-icon"><LinkIcon /></div>
                            <div>
                                <h3>Create for later</h3>
                                <p>Copy a link to share</p>
                            </div>
                        </button>
                    </div>

                    <div className="home-join">
                        <h4>Join a meeting</h4>
                        <JoinForm />
                    </div>
                </section>

                <section className="home-recent">
                    <div className="section-head">
                        <h2>Recent meetings</h2>
                        <button className="btn btn-ghost" onClick={() => navigate("/history")}>
                            View all <ArrowForwardIcon fontSize="small" />
                        </button>
                    </div>

                    {recent === null ? (
                        <div className="recent-list">
                            {[0, 1, 2].map((i) => <div key={i} className="skeleton-row" />)}
                        </div>
                    ) : recent.length === 0 ? (
                        <div className="empty-state">
                            <ScheduleIcon />
                            <p>No meetings yet. Your recent meetings will show up here.</p>
                        </div>
                    ) : (
                        <ul className="recent-list">
                            {recent.map((m) => (
                                <li key={m._id} className="recent-item">
                                    <div className="recent-icon"><VideoCallOutlinedIcon fontSize="small" /></div>
                                    <div className="recent-meta">
                                        <div className="recent-code">{m.meetingCode}</div>
                                        <div className="recent-date">{formatRelative(m.date)}</div>
                                    </div>
                                    <RejoinButton code={m.meetingCode} count={countFor(live, m.meetingCode)} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </main>
        </div>
    );
}
