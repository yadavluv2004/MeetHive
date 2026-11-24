// Backend URL. Set REACT_APP_SERVER_URL in .env (see .env.example).
// In development we default to the same host on port 8000 so LAN devices work too.
const fromEnv = process.env.REACT_APP_SERVER_URL;

export const SERVER_URL = (
    fromEnv ||
    (process.env.NODE_ENV === "production"
        ? "https://meethivebackend.onrender.com"
        : `${window.location.protocol}//${window.location.hostname}:8000`)
).replace(/\/$/, "");

export const APP_NAME = "MeetHive";
