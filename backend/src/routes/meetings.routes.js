import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getLiveCounts } from "../controllers/socketManager.js";

const router = Router();
const CODE_RE = /^[a-zA-Z0-9_-]{3,64}$/;
const MAX_CODES = 50;

// GET /api/v1/meetings/status?codes=abc-defg-hij,xyz-...
// -> { status: { "abc-defg-hij": 2, "xyz-...": 0 } }
router.get("/status", requireAuth, (req, res) => {
    const codes = [...new Set(String(req.query.codes || "").split(","))]
        .map((c) => c.trim())
        .filter((c) => CODE_RE.test(c))
        .slice(0, MAX_CODES);
    res.json({ status: getLiveCounts(codes) });
});

export default router;
