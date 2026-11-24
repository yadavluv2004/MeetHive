import httpStatus from "http-status";
import { User } from "../models/user.model.js";
import { hashToken } from "../utils/token.js";

const extractToken = (req) => {
    const header = req.headers.authorization || "";
    if (header.startsWith("Bearer ")) return header.slice(7).trim();
    return null;
};

export const requireAuth = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) return res.status(httpStatus.UNAUTHORIZED).json({ message: "Authentication required" });

        const user = await User.findOne({ tokenHash: hashToken(token) });
        if (!user || !user.tokenExpires || user.tokenExpires < new Date()) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Session expired, please log in again" });
        }

        req.user = user;
        next();
    } catch (e) {
        next(e);
    }
};
