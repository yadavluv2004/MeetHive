import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import HistoryIcon from "@mui/icons-material/History";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useAuth } from "../contexts/AuthContext";
import { avatarColor, initials } from "../utils/meetingCode";

export default function UserMenu() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const name = user?.name || "Account";

    return (
        <div className="user-menu" ref={ref}>
            <button
                className="avatar avatar-sm"
                style={{ background: avatarColor(user?.username || name) }}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                title={name}
            >
                {initials(name)}
            </button>
            {open && (
                <div className="menu" role="menu">
                    <div className="menu-header">
                        <div className="avatar" style={{ background: avatarColor(user?.username || name) }}>
                            {initials(name)}
                        </div>
                        <div>
                            <div className="menu-name">{name}</div>
                            {user?.username && <div className="menu-sub">@{user.username}</div>}
                        </div>
                    </div>
                    <button role="menuitem" onClick={() => navigate("/home")}>
                        <HomeOutlinedIcon fontSize="small" /> Home
                    </button>
                    <button role="menuitem" onClick={() => navigate("/history")}>
                        <HistoryIcon fontSize="small" /> Meeting history
                    </button>
                    <button
                        role="menuitem"
                        onClick={async () => {
                            await logout();
                            navigate("/");
                        }}
                    >
                        <LogoutIcon fontSize="small" /> Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
