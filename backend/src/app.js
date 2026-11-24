import express from "express";
import { createServer } from "node:http";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

import { config } from "./config.js";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/users.routes.js";
import meetingRoutes from "./routes/meetings.routes.js";
import { getIceServers } from "./controllers/ice.controller.js";

const app = express();
const server = createServer(app);

// Render / Heroku / Nginx put us behind a proxy - needed for correct client IPs in rate limiting
app.set("trust proxy", 1);

const corsOptions = {
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true,
};

app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: "40kb" }));
app.use(express.urlencoded({ limit: "40kb", extended: true }));

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
});

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
        uptime: Math.round(process.uptime()),
    });
});

app.use("/api", apiLimiter);
app.get("/api/v1/ice-servers", getIceServers);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/meetings", meetingRoutes);

app.use((_req, res) => res.status(404).json({ message: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: config.isProd ? "Internal server error" : err.message });
});

const io = connectToSocket(server, corsOptions);

const start = async () => {
    try {
        const conn = await mongoose.connect(config.mongoUri);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e.message);
        process.exit(1);
    }

    server.listen(config.port, () => {
        console.log(`MeetHive server listening on port ${config.port} (${config.env})`);
        startKeepAlive();
    });
};

// Ping our own public URL so Render sees traffic and doesn't put the free instance to sleep.
// It must go through the public URL (not localhost) - only requests via Render's proxy count.
let keepAliveTimer = null;
const startKeepAlive = () => {
    if (!config.keepAliveUrl) return;
    const url = `${config.keepAliveUrl.replace(/\/$/, "")}/health`;
    const ping = async () => {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) console.warn(`Keep-alive ping got HTTP ${res.status}`);
        } catch (e) {
            console.warn("Keep-alive ping failed:", e.message);
        }
    };
    keepAliveTimer = setInterval(ping, config.keepAliveMinutes * 60 * 1000);
    console.log(`Keep-alive: pinging ${url} every ${config.keepAliveMinutes} min`);
};

const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    clearInterval(keepAliveTimer);
    io.close();
    server.close(async () => {
        await mongoose.connection.close();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
