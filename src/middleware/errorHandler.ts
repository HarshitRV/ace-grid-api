import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface AppError extends Error {
    statusCode?: number;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        return res.status(400).json({
            message: "Validation error",
            errors: err.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error";

    if (statusCode === 500) {
        console.error("Unhandled error:", err);
    }

    return res.status(statusCode).json({ message });
}
