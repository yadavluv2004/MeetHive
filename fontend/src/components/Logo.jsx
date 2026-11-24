import { useId } from "react";
import { Link } from "react-router-dom";

// Clicking the logo always goes to the main landing page.
export default function Logo({ size = "md" }) {
    const gradientId = `logo-grad-${useId().replace(/:/g, "")}`;
    return (
        <Link to="/" className={`logo logo-${size}`} aria-label="MeetHive home" title="Go to home">
            <svg viewBox="0 0 32 32" className="logo-mark" aria-hidden="true">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#22D3EE" />
                    </linearGradient>
                </defs>
                <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25z" fill={`url(#${gradientId})`} />
                <path d="M11 12.5h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" fill="#fff" />
                <path d="m20 15.2 3.5-2.2v6l-3.5-2.2z" fill="#fff" />
            </svg>
            <span className="logo-text">
                Meet<b>Hive</b>
            </span>
        </Link>
    );
}
