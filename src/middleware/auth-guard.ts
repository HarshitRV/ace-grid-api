import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "@/utils/jwt.js";
import { User } from "@/models/user.js";
import { sendError } from "@/utils/api-errors.js";

export interface AuthRequest extends Request {
    user?: { userId: string; email: string; role: "user" | "admin" };
}

export async function authGuard(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return sendError(res, 401, "UNAUTHENTICATED", "Authentication required");
    }
    try {
        const payload = verifyToken(token);

        // Fetch fresh user data from DB to ensure role is up-to-date
        const user = await User.findById(payload.userId).select("email role").lean();
        if (!user) {
            return sendError(res, 401, "UNAUTHENTICATED", "User no longer exists");
        }

        req.user = {
            userId: payload.userId,
            email: user.email,
            role: user.role,
        };

        next();
    } catch {
        return sendError(res, 401, "UNAUTHENTICATED", "Invalid or expired token");
    }
}

export function adminGuard(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
        return sendError(res, 403, "FORBIDDEN", "Admin access required");
    }
    next();
}
