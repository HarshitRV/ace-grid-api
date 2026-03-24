import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "@/utils/connectDB.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { authRouter } from "@/routes/auth.js";
import { coursesRouter } from "@/routes/courses.js";
import { examsRouter } from "@/routes/exams.js";
import { attemptsRouter } from "@/routes/attempts.js";
import { adminRouter } from "@/routes/admin.js";
import { appConfig } from "@/config/app-config.js";

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
        message: { message: "Too many requests, please try again later." },
    })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/exams", examsRouter);
app.use("/api/attempts", attemptsRouter);
app.use("/api/admin", adminRouter);

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
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
