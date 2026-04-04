import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "@/utils/connect-db.js";
import { errorHandler } from "@/middleware/error-handler.js";
import { appConfig } from "@/config/app-config.js";
import { API_VERSIONS } from "@/config/api-versions.js";
import { createVersionRouter } from "@/routes/create-version-router.js";
import { sendError } from "@/utils/api-errors.js";

const app = express();
const PORT = appConfig.env.PORT;

// ── Security & Middleware ─────────────────────────────────────────────────────
app.set("trust proxy", 1); // trust first proxy (needed for rate-limiter behind reverse proxy)
app.use(helmet());
app.use(cors({ origin: appConfig.env.CORS_ORIGIN, credentials: true }));
app.use(compression());
app.use(express.json());
app.use(morgan(appConfig.env.NODE_ENV === "production" ? "combined" : "dev"));

// Global rate limiter
app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            return sendError(
                res,
                429,
                "RATE_LIMITED",
                "Too many requests, please try again later."
            );
        },
    })
);

// ── Versioned Routes ──────────────────────────────────────────────────────────
for (const version of API_VERSIONS) {
    app.use(createVersionRouter(version));
}

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Route not found
app.use((req, res) => {
    return sendError(
        res,
        404,
        "NOT_FOUND",
        `Route not found: ${req.method} ${req.originalUrl}`
    );
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`🚀 API server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("❌ Failed to connect to MongoDB:", err);
        process.exit(1);
    });

export default app;
