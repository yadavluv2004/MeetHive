const LETTERS = "abcdefghijkmnopqrstuvwxyz";

const randomLetters = (n) => {
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => LETTERS[b % LETTERS.length]).join("");
};

/** Google-Meet style code, e.g. "abc-defg-hij" */
export const generateMeetingCode = () => `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;

export const isValidMeetingCode = (code) => /^[a-zA-Z0-9_-]{3,64}$/.test(code || "");

/** Accepts a raw code or a full invite link and returns the code (or null). */
export const parseMeetingInput = (input) => {
    const value = (input || "").trim();
    if (!value) return null;
    let candidate = value;
    try {
        const url = new URL(value);
        const parts = url.pathname.split("/").filter(Boolean);
        candidate = parts[parts.length - 1] || "";
    } catch {
        /* not a URL - treat as code */
    }
    candidate = candidate.replace(/\s+/g, "");
    return isValidMeetingCode(candidate) ? candidate : null;
};

export const meetingLink = (code) => `${window.location.origin}/meet/${code}`;

export const initials = (name = "") =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "?";

const AVATAR_COLORS = ["#E8710A", "#7B61FF", "#0B8043", "#D93025", "#1A73E8", "#C2185B", "#00897B", "#5F6368"];

export const avatarColor = (seed = "") => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    }
};
