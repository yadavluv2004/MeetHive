import httpStatus from "http-status";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import { generateToken, hashToken } from "../utils/token.js";
import { config } from "../config.js";

const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
const MEETING_CODE_RE = /^[a-zA-Z0-9_-]{3,64}$/;

const publicUser = (user) => ({ name: user.name, username: user.username });

const login = async (req, res, next) => {
    const rawUsername = String(req.body?.username || "").trim();
    const username = rawUsername.toLowerCase();
    const password = String(req.body?.password || "");

    if (!username || !password) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Username and password are required" });
    }

    try {
        // Fallback to the exact spelling for accounts created before usernames were normalised
        const user = (await User.findOne({ username })) || (await User.findOne({ username: rawUsername }));
        // Same response for unknown user / wrong password - don't leak which usernames exist
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }

        const token = generateToken();
        user.tokenHash = hashToken(token);
        user.tokenExpires = new Date(Date.now() + config.tokenTtlDays * 24 * 60 * 60 * 1000);
        await user.save();

        return res.status(httpStatus.OK).json({ token, user: publicUser(user) });
    } catch (e) {
        next(e);
    }
};

const register = async (req, res, next) => {
    const name = String(req.body?.name || "").trim();
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!name || name.length > 60) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Please enter your name (max 60 characters)" });
    }
    if (!USERNAME_RE.test(username)) {
        return res.status(httpStatus.BAD_REQUEST).json({
            message: "Username must be 3-30 characters: letters, numbers, dot, dash or underscore",
        });
    }
    if (password.length < 8 || password.length > 128) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Password must be at least 8 characters" });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username is already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        await User.create({ name, username, password: hashedPassword });

        return res.status(httpStatus.CREATED).json({ message: "Account created! You can sign in now." });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username is already taken" });
        }
        next(e);
    }
};

const logout = async (req, res, next) => {
    try {
        req.user.tokenHash = undefined;
        req.user.tokenExpires = undefined;
        await req.user.save();
        res.json({ message: "Logged out" });
    } catch (e) {
        next(e);
    }
};

const me = (req, res) => res.json({ user: publicUser(req.user) });

const getUserHistory = async (req, res, next) => {
    try {
        const meetings = await Meeting.find({ user_id: req.user.username }).sort({ date: -1 }).limit(100).lean();
        res.json(meetings);
    } catch (e) {
        next(e);
    }
};

const addToUserHistory = async (req, res, next) => {
    const meetingCode = String(req.body?.meeting_code || "").trim();
    if (!MEETING_CODE_RE.test(meetingCode)) {
        return res.status(httpStatus.BAD_REQUEST).json({ message: "Invalid meeting code" });
    }

    try {
        await Meeting.create({ user_id: req.user.username, meetingCode });
        res.status(httpStatus.CREATED).json({ message: "Added code to history" });
    } catch (e) {
        next(e);
    }
};

const deleteHistoryItem = async (req, res, next) => {
    try {
        await Meeting.deleteOne({ _id: req.params.id, user_id: req.user.username });
        res.json({ message: "Deleted" });
    } catch (e) {
        next(e);
    }
};

export { login, register, logout, me, getUserHistory, addToUserHistory, deleteHistoryItem };
