import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEMES = [
    { id: "burgundy", name: "Burgundy", swatch: ["#3F1D2E", "#FBCFE8"], meta: "#1B0C15" },
    { id: "blush", name: "Blush", swatch: ["#FBCFE8", "#3F1D2E"], meta: "#FFF5FA" },
    { id: "midnight", name: "Midnight", swatch: ["#6366F1", "#22D3EE"], meta: "#0A0F1E" },
];

const KEY = "meethive:theme";
const DEFAULT = "burgundy";

const readTheme = () => {
    try {
        const saved = localStorage.getItem(KEY);
        return THEMES.some((t) => t.id === saved) ? saved : DEFAULT;
    } catch {
        return DEFAULT;
    }
};

const ThemeContext = createContext({ theme: DEFAULT, setTheme: () => {} });

export const ThemeProvider = ({ children }) => {
    const [theme, setThemeState] = useState(readTheme);

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        const meta = document.querySelector('meta[name="theme-color"]');
        const def = THEMES.find((t) => t.id === theme);
        if (meta && def) meta.setAttribute("content", def.meta);
    }, [theme]);

    const setTheme = useCallback((id) => {
        if (!THEMES.some((t) => t.id === id)) return;
        setThemeState(id);
        try {
            localStorage.setItem(KEY, id);
        } catch {
            /* ignore */
        }
    }, []);

    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
