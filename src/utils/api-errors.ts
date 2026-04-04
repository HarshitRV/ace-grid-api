import type { Response } from "express";

export type ApiErrorCode =
    | "BAD_REQUEST"
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "VALIDATION_ERROR"
    | "RATE_LIMITED"
    | "INTERNAL_SERVER_ERROR";

export interface ErrorEnvelope {
    statusCode: number;
    message: string;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export class HttpError extends Error {
    statusCode: number;
    code: string;
    details?: unknown;

    constructor(statusCode: number, code: string, message: string, details?: unknown) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export function httpError(statusCode: number, code: string, message: string, details?: unknown): HttpError {
    return new HttpError(statusCode, code, message, details);
}

export function statusToDefaultErrorCode(statusCode: number): ApiErrorCode {
    switch (statusCode) {
        case 400:
            return "BAD_REQUEST";
        case 401:
            return "UNAUTHENTICATED";
        case 403:
            return "FORBIDDEN";
        case 404:
            return "NOT_FOUND";
        case 409:
            return "CONFLICT";
        case 422:
            return "VALIDATION_ERROR";
        case 429:
            return "RATE_LIMITED";
        default:
            return "INTERNAL_SERVER_ERROR";
    }
}

export function buildErrorResponse(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
): ErrorEnvelope {
    return {
        statusCode,
        message,
        error: {
            code,
            message,
            ...(details === undefined ? {} : { details }),
        },
    };
}

export function sendError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: unknown
): Response {
    return res.status(statusCode).json(buildErrorResponse(statusCode, code, message, details));
}
