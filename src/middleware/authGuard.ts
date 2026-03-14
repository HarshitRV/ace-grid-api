import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt.js";

export interface AuthRequest extends Request {
    user?: { userId: string; email: string; role: "user" | "admin" };
}

export function authGuard(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authentication required" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    try {
        const payload = verifyToken(token);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

export function adminGuard(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}
