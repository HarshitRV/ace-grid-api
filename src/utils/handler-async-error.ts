import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middleware/auth-guard.js';

type AsyncHandler = (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
) => Promise<void>;

type RequestHandler = (
    req: AuthRequest,
    res: Response,
    next: NextFunction,
) => void;

/**
 * Wraps an async handler function to properly handle errors
 */
export const handleAsyncError = (f: AsyncHandler): RequestHandler => {
    return function (req: AuthRequest, res: Response, next: NextFunction): void {
        f(req, res, next).catch(e => next(e));
    };
};

/**
 * Takes multiple async handlers and returns them as individual arguments
 * instead of an array
 */
export function wrapAsyncHandler(
    ...handlers: AsyncHandler[]
): RequestHandler[] {
    return handlers.map(handler => handleAsyncError(handler));
}

