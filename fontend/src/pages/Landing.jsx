import { useNavigate } from "react-router-dom";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import PublicIcon from "@mui/icons-material/Public";
import ScreenShareOutlinedIcon from "@mui/icons-material/ScreenShareOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DevicesIcon from "@mui/icons-material/Devices";
import MicOffIcon from "@mui/icons-material/MicOff";
import Logo from "../components/Logo";
import JoinForm from "../components/JoinForm";
import UserMenu from "../components/UserMenu";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { useAuth } from "../contexts/AuthContext";
import { generateMeetingCode } from "../utils/meetingCode";
import useSeo from "../utils/useSeo";
import "../App.css";

const FEATURES = [
    { icon: VideocamOutlinedIcon, title: "HD video & audio", text: "Crisp video with adaptive quality that adjusts to every participant's connection." },
    { icon: PublicIcon, title: "Works on any network", text: "Wi-Fi, mobile data or office firewalls — TURN relays keep everyone connected." },
    { icon: ScreenShareOutlinedIcon, title: "Screen sharing", text: "Present your screen, a window or a tab with one click. No plugins needed." },
    { icon: ChatBubbleOutlineIcon, title: "In-call chat & reactions", text: "Send messages, raise your hand and react without interrupting the speaker." },
    { icon: LockOutlinedIcon, title: "Private by design", text: "Media flows encrypted end-to-end between browsers with DTLS-SRTP." },
    { icon: DevicesIcon, title: "Any device", text: "Join from desktop, tablet or phone right in the browser — nothing to install." },
];

const FAQS = [
    { q: "Is MeetHive free?", a: "Yes. MeetHive is free to use for video meetings, screen sharing and chat." },
    { q: "Do I need to download anything to use MeetHive?", a: "No. MeetHive runs entirely in your web browser on desktop, tablet or phone." },
    { q: "Can guests join a MeetHive meeting without an account?", a: "Yes. Anyone with the meeting code or link can join as a guest. You only need an account to start a meeting." },
    { q: "Are MeetHive video calls secure?", a: "Media is sent encrypted between browsers using WebRTC with DTLS-SRTP." },
    { q: "Can I share my screen in MeetHive?", a: "Yes. You can share your whole screen, a window or a browser tab with one click." },
];

const MOCK_TILES = [
    { name: "Aisha", color: "#7B61FF" },
    { name: "Rahul", color: "#0B8043", muted: true },
    { name: "Mei", color: "#E8710A" },
    { name: "You", color: "#1A73E8", speaking: true },
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    useSeo({ path: "/" });

    const startMeeting = () => {
        if (isAuthenticated) navigate(`/meet/${generateMeetingCode()}`);
        else navigate("/auth?next=/home");
    };

    return (
        <div className="landing">
            <header className="site-nav">
                <Logo />
                <nav className="site-nav-links">
                    <ThemeSwitcher />
                    {isAuthenticated ? (
                        <>
                            <button className="btn btn-ghost" onClick={() => navigate("/home")}>Dashboard</button>
                            <UserMenu />
                        </>
                    ) : (
                        <>
                            <button className="btn btn-ghost hide-sm" onClick={() => navigate("/auth")}>Sign in</button>
                            <button className="btn btn-dark" onClick={() => navigate("/auth?mode=signup")}>Get started</button>
                        </>
                    )}
                </nav>
            </header>

            <main>
                <section className="hero">
                    <div className="hero-copy">
                        <span className="eyebrow">Free • Secure • No downloads</span>
                        <h1>
                            Meet face to face,<br />
                            <span className="gradient-text">from anywhere.</span>
                        </h1>
                        <p className="lead">
                            MeetHive is a free video conferencing app that brings your team, class or family together with HD video
                            calls, screen sharing and chat — right in the browser, across any network.
                        </p>
                        <div className="hero-actions">
                            <button className="btn btn-primary btn-lg" onClick={startMeeting}>
                                <VideocamOutlinedIcon /> New meeting
                            </button>
                            <div className="hero-join">
                                <JoinForm />
                            </div>
                        </div>
                        <p className="hero-note">Guests can join with just a code — no account needed.</p>
                    </div>

                    <div className="hero-visual" aria-hidden="true">
                        <div className="mock-window">
                            <div className="mock-bar">
                                <span /><span /><span />
                                <div className="mock-code">abc-defg-hij</div>
                            </div>
                            <div className="mock-grid">
                                {MOCK_TILES.map((t) => (
                                    <div key={t.name} className={`mock-tile ${t.speaking ? "speaking" : ""}`}>
                                        <div className="mock-avatar" style={{ background: t.color }}>{t.name[0]}</div>
                                        <div className="mock-name">
                                            {t.muted && <MicOffIcon style={{ fontSize: 14 }} />} {t.name}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mock-controls">
                                <span /><span /><span className="end" /><span /><span />
                            </div>
                        </div>
                        <div className="float-card float-1">🎉 Mei reacted</div>
                        <div className="float-card float-2">✋ Rahul raised a hand</div>
                    </div>
                </section>

                <section className="features">
                    <h2>Everything you need for great meetings</h2>
                    <div className="feature-grid">
                        {FEATURES.map(({ icon: Icon, title, text }) => (
                            <div className="feature-card" key={title}>
                                <div className="feature-icon"><Icon /></div>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="features faq" aria-labelledby="faq-heading">
                    <h2 id="faq-heading">Frequently asked questions</h2>
                    <div className="faq-list">
                        {FAQS.map(({ q, a }) => (
                            <details className="feature-card faq-item" key={q}>
                                <summary><h3>{q}</h3></summary>
                                <p>{a}</p>
                            </details>
                        ))}
                    </div>
                </section>

                <section className="cta-band">
                    <h2>Ready to start your first meeting?</h2>
                    <p>Create a free account in seconds and invite anyone with a link.</p>
                    <button className="btn btn-primary btn-lg" onClick={startMeeting}>Start for free</button>
                </section>
            </main>

            <footer className="site-footer">
                <Logo size="sm" />
                <span>© {new Date().getFullYear()} MeetHive. Built with WebRTC.</span>
                <span>Made by Luv Yadav</span>
            </footer>
        </div>
    );
}
