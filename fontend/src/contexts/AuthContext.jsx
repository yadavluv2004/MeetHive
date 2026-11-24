import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY } from "../api/client";

export const AuthContext = createContext(null);

const USER_KEY = "user";

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
        return null;
    }
};

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
    const [user, setUser] = useState(readStoredUser);

    const clearSession = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
    }, []);

    // Validate the stored session once on load and whenever the API says it's expired
    useEffect(() => {
        const id = api.interceptors.response.use(
            (r) => r,
            (err) => {
                if (err?.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) clearSession();
                return Promise.reject(err);
            }
        );
        return () => api.interceptors.response.eject(id);
    }, [clearSession]);

    useEffect(() => {
        if (!token) return;
        api.get("/users/me")
            .then(({ data }) => {
                setUser(data.user);
                localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            })
            .catch(() => {});
    }, [token]);

    const handleLogin = useCallback(async (username, password) => {
        const { data } = await api.post("/users/login", { username, password });
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const handleRegister = useCallback(async (name, username, password) => {
        const { data } = await api.post("/users/register", { name, username, password });
        return data.message;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post("/users/logout");
        } catch {
            /* token may already be invalid - ignore */
        }
        clearSession();
    }, [clearSession]);

    const getHistoryOfUser = useCallback(async () => {
        const { data } = await api.get("/users/get_all_activity");
        return Array.isArray(data) ? data : [];
    }, []);

    const addToUserHistory = useCallback(async (meetingCode) => {
        if (!localStorage.getItem(TOKEN_KEY)) return;
        await api.post("/users/add_to_activity", { meeting_code: meetingCode });
    }, []);

    const deleteHistoryItem = useCallback(async (id) => {
        await api.delete(`/users/activity/${id}`);
    }, []);

    const value = useMemo(
        () => ({
            user,
            token,
            isAuthenticated: !!token,
            handleLogin,
            handleRegister,
            logout,
            getHistoryOfUser,
            addToUserHistory,
            deleteHistoryItem,
        }),
        [user, token, handleLogin, handleRegister, logout, getHistoryOfUser, addToUserHistory, deleteHistoryItem]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
