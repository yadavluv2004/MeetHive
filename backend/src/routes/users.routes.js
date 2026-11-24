import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
    addToUserHistory,
    deleteHistoryItem,
    getUserHistory,
    login,
    logout,
    me,
    register,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Brute-force protection on credential endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many attempts, please try again in a few minutes" },
});

router.post("/login", authLimiter, login);
router.post("/register", authLimiter, register);
router.post("/logout", requireAuth, logout);
router.get("/me", requireAuth, me);
router.post("/add_to_activity", requireAuth, addToUserHistory);
router.get("/get_all_activity", requireAuth, getUserHistory);
router.delete("/activity/:id", requireAuth, deleteHistoryItem);

export default router;
