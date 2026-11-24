import { useEffect, useRef, useState } from "react";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import CheckIcon from "@mui/icons-material/Check";
import { THEMES, useTheme } from "../contexts/ThemeContext";

/** Row of theme swatches - used inside menus and settings dialogs. */
export function ThemeOptions({ compact = false }) {
    const { theme, setTheme } = useTheme();
    return (
        <div className={`theme-options ${compact ? "compact" : ""}`} role="radiogroup" aria-label="App theme">
            {THEMES.map((t) => (
                <button
                    key={t.id}
                    role="radio"
                    aria-checked={theme === t.id}
                    className={`theme-option ${theme === t.id ? "active" : ""}`}
                    onClick={() => setTheme(t.id)}
                    title={`${t.name} theme`}
                >
                    <span
                        className="theme-swatch"
                        style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }}
                    >
                        {theme === t.id && <CheckIcon style={{ fontSize: 16 }} />}
                    </span>
                    <span className="theme-name">{t.name}</span>
                </button>
            ))}
        </div>
    );
}

/** Palette button with a dropdown, for page headers. */
export default function ThemeSwitcher() {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    return (
        <div className="user-menu" ref={ref}>
            <button
                className="icon-btn"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={open}
                aria-label="Change theme"
                title="Change theme"
            >
                <PaletteOutlinedIcon />
            </button>
            {open && (
                <div className="menu theme-menu">
                    <div className="menu-label">Theme</div>
                    <ThemeOptions />
                </div>
            )}
        </div>
    );
}
