import jwt from "jsonwebtoken";
import { appConfig } from "../config/app-config.js";

const JWT_SECRET = appConfig.env.JWT_SECRET;
const JWT_EXPIRES_IN = appConfig.env.JWT_EXPIRES_IN;

export interface JwtPayload {
    userId: string;
    email: string;
    role: "user" | "admin";
}

export function signToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
