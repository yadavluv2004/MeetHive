import crypto from "node:crypto";
import { config } from "../config.js";

// Cache Metered responses so we don't hit their API on every join
let meteredCache = { servers: null, expires: 0 };

const fetchMetered = async () => {
    if (meteredCache.servers && meteredCache.expires > Date.now()) return meteredCache.servers;

    const url = `https://${config.meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(config.meteredApiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Metered API responded ${res.status}`);
    const servers = await res.json();
    meteredCache = { servers, expires: Date.now() + 30 * 60 * 1000 };
    return servers;
};

/**
 * Time-limited TURN credentials (coturn "use-auth-secret" / TURN REST API spec).
 * username = "<expiry-unix-ts>:<label>", credential = base64(HMAC-SHA1(secret, username))
 */
const coturnCredentials = (label) => {
    const expiry = Math.floor(Date.now() / 1000) + config.turnTtlSeconds;
    const username = `${expiry}:${label}`;
    const credential = crypto.createHmac("sha1", config.turnSecret).update(username).digest("base64");
    return { username, credential };
};

export const getIceServers = async (req, res) => {
    const iceServers = [{ urls: config.stunUrls }];

    try {
        if (config.meteredDomain && config.meteredApiKey) {
            const metered = await fetchMetered();
            iceServers.push(...metered);
        }
    } catch (e) {
        console.error("Failed to fetch Metered TURN credentials:", e.message);
    }

    if (config.turnUrls.length) {
        if (config.turnSecret) {
            iceServers.push({ urls: config.turnUrls, ...coturnCredentials("meethive") });
        } else if (config.turnUsername && config.turnCredential) {
            iceServers.push({
                urls: config.turnUrls,
                username: config.turnUsername,
                credential: config.turnCredential,
            });
        }
    }

    res.set("Cache-Control", "no-store");
    res.json({ iceServers });
};
