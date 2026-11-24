import "dotenv/config";

const list = (value) =>
    (value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

export const config = {
    env: process.env.NODE_ENV || "development",
    isProd: process.env.NODE_ENV === "production",
    port: Number(process.env.PORT) || 8000,
    mongoUri: process.env.MONGO_URI,

    // Comma separated list of allowed frontend origins. Empty = allow all (dev only).
    corsOrigins: list(process.env.CORS_ORIGINS),

    // Session token lifetime (days)
    tokenTtlDays: Number(process.env.TOKEN_TTL_DAYS) || 7,

    // ---- ICE / TURN configuration (needed for calls across different networks) ----
    stunUrls: list(process.env.STUN_URLS).length
        ? list(process.env.STUN_URLS)
        : ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],

    // Option A: static TURN credentials (Metered, Twilio, Xirsys, your own coturn ...)
    turnUrls: list(process.env.TURN_URLS),
    turnUsername: process.env.TURN_USERNAME,
    turnCredential: process.env.TURN_CREDENTIAL,

    // Option B: coturn with `use-auth-secret` / `static-auth-secret` (time-limited credentials)
    turnSecret: process.env.TURN_SECRET,
    turnTtlSeconds: Number(process.env.TURN_TTL_SECONDS) || 6 * 60 * 60,

    // Option C: Metered.ca TURN API (free tier available) - credentials fetched server-side
    meteredDomain: process.env.METERED_DOMAIN, // e.g. "yourapp.metered.live"
    meteredApiKey: process.env.METERED_API_KEY,

    // ---- Keep-alive (stops Render's free tier from sleeping after 15 min idle) ----
    // Render sets RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL overrides it. Empty = disabled.
    keepAliveUrl: process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || "",
    keepAliveMinutes: Number(process.env.KEEP_ALIVE_MINUTES) || 10,
};

if (!config.mongoUri) {
    console.error("FATAL: MONGO_URI environment variable is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
}

if (config.isProd && config.corsOrigins.length === 0) {
    console.warn("WARNING: CORS_ORIGINS is empty in production - any website can call this API.");
}

const hasTurn =
    (config.turnUrls.length && ((config.turnUsername && config.turnCredential) || config.turnSecret)) ||
    (config.meteredDomain && config.meteredApiKey);

if (!hasTurn) {
    console.warn(
        "WARNING: No TURN server configured. Calls will only work when peers can reach each other directly " +
        "(usually same network). Set TURN_* or METERED_* env vars for cross-network calls."
    );
}
