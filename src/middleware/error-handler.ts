import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError, sendError, statusToDefaultErrorCode } from "@/utils/api-errors.js";

export interface AppError extends Error {
    statusCode?: number;
    code?: string;
    details?: unknown;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        return sendError(res, 422, "VALIDATION_ERROR", "Validation failed", err.flatten());
    }

    if (err instanceof HttpError) {
        return sendError(res, err.statusCode, err.code, err.message, err.details);
    }

    if (err.name === "CastError") {
        return sendError(res, 400, "BAD_REQUEST", "Invalid resource identifier");
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal server error";
    const code = err.code || statusToDefaultErrorCode(statusCode);

    if (statusCode === 500) {
        console.error("Unhandled error:", err);
    }

    return sendError(res, statusCode, code, message, err.details);
}
