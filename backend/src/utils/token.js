import crypto from "node:crypto";

export const generateToken = () => crypto.randomBytes(32).toString("hex");

// Only a hash of the session token is stored, so a DB leak doesn't leak live sessions
export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
