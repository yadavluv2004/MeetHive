import axios from "axios";
import { SERVER_URL } from "../config";

export const TOKEN_KEY = "token";

export const api = axios.create({
    baseURL: `${SERVER_URL}/api/v1`,
    timeout: 15000,
});

api.interceptors.request.use((cfg) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

export const errorMessage = (err, fallback = "Something went wrong. Please try again.") => {
    if (err?.response?.data?.message) return err.response.data.message;
    if (err?.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
    if (err?.message === "Network Error") return "Can't reach the server. Check your connection.";
    return fallback;
};

export const fetchIceServers = async () => {
    try {
        const { data } = await api.get("/ice-servers", { timeout: 6000 });
        if (Array.isArray(data?.iceServers) && data.iceServers.length) return data.iceServers;
    } catch (e) {
        console.warn("Could not load ICE servers, falling back to public STUN", e);
    }
    return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
};
