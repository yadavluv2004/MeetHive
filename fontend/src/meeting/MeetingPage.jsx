import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Lobby from "./Lobby";
import Room from "./Room";
import Logo from "../components/Logo";
import useLocalMedia from "./useLocalMedia";
import useBackgroundEffect from "./useBackgroundEffect";
import useWallpaper from "./useWallpaper";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { copyText, isValidMeetingCode, meetingLink } from "../utils/meetingCode";
import { formatDuration } from "../utils/format";
import NotFound from "../pages/NotFound";
import { DEFAULT_TITLE } from "../utils/useSeo";
import "./meeting.css";

const NAME_KEY = "meethive:display-name";

export default function MeetingPage() {
    const { code } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { user, isAuthenticated, addToUserHistory } = useAuth();

    const [phase, setPhase] = useState("lobby"); // lobby | room | left
    const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || user?.name || "");
    const [joining, setJoining] = useState(false);
    const [joinedAt, setJoinedAt] = useState(null);
    const [leftAfter, setLeftAfter] = useState(0);

    const rawMedia = useLocalMedia(phase !== "left");
    const background = useBackgroundEffect(rawMedia.videoTrack);
    const wallpaper = useWallpaper();
    // Everything downstream (preview, self tile, peers) uses the processed camera track
    const media = { ...rawMedia, videoTrack: background.track };

    useEffect(() => {
        if (!name && user?.name) setName(user.name);
    }, [user, name]);

    useEffect(() => {
        document.title = phase === "room" ? `${code} · MeetHive` : "Join meeting · MeetHive";
        // Individual meeting rooms must never be indexed by search engines
        const robots = document.head.querySelector('meta[name="robots"]');
        const prev = robots?.getAttribute("content");
        robots?.setAttribute("content", "noindex, nofollow");
        return () => {
            document.title = DEFAULT_TITLE;
            if (robots && prev) robots.setAttribute("content", prev);
        };
    }, [phase, code]);

    // Warn before closing the tab mid-call
    useEffect(() => {
        if (phase !== "room") return;
        const handler = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [phase]);

    const copyLink = useCallback(async () => {
        const ok = await copyText(meetingLink(code));
        toast(ok ? "Meeting link copied to clipboard" : "Couldn't copy the link", { type: ok ? "success" : "error" });
    }, [code, toast]);

    const join = async () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        localStorage.setItem(NAME_KEY, trimmed);
        setJoining(true);
        if (isAuthenticated) addToUserHistory(code).catch(() => {});
        setJoining(false);
        setJoinedAt(Date.now());
        setPhase("room");
    };

    const leave = useCallback(() => {
        setLeftAfter(joinedAt ? Date.now() - joinedAt : 0);
        setPhase("left");
    }, [joinedAt]);

    if (!isValidMeetingCode(code)) return <NotFound />;

    if (typeof window.RTCPeerConnection === "undefined") {
        return (
            <div className="room-state light">
                <Logo />
                <h2>Your browser doesn't support video calls</h2>
                <p>Please use a recent version of Chrome, Edge, Firefox or Safari.</p>
            </div>
        );
    }

    if (phase === "left") {
        return (
            <div className="room-state light">
                <Logo />
                <h2>You left the meeting</h2>
                {leftAfter > 0 && <p>You were in the call for {formatDuration(leftAfter)}.</p>}
                <div className="left-actions">
                    <button className="btn btn-outline" onClick={() => setPhase("lobby")}>Rejoin</button>
                    <button className="btn btn-primary" onClick={() => navigate(isAuthenticated ? "/home" : "/")}>
                        Return to home screen
                    </button>
                </div>
            </div>
        );
    }

    if (phase === "room") {
        return <Room code={code} name={name.trim()} media={media} background={background} wallpaper={wallpaper} onLeave={leave} onCopyLink={copyLink} />;
    }

    return (
        <Lobby
            code={code}
            media={media}
            background={background}
            wallpaper={wallpaper}
            name={name}
            setName={setName}
            onJoin={join}
            onCopyLink={copyLink}
            joining={joining}
        />
    );
}
