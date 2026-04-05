import { Router } from "express";
import { RegisterInputSchema, LoginInputSchema, AuthRoute } from "@/schemas/domain/auth.js";
import { authGuard } from "@/middleware/auth-guard.js";
import { HttpError } from "@/utils/api-errors.js";
import { AuthController } from "@/controllers/auth.controller.js";
import { handleAsyncError, wrapAsyncHandler } from "@/utils/handler-async-error.js";

export const authRouter = Router();

// POST v1/api/auth/register
authRouter.route<AuthRoute>('/register').post(handleAsyncError(async (req, res, _next) => {
    const body = RegisterInputSchema.parse(req.body);
    const response = await AuthController.register(body);
    res.status(201).json(response);
}));

// POST v1/api/auth/login
authRouter.route<AuthRoute>('/login').post(handleAsyncError(async (req, res, _next) => {
    const body = LoginInputSchema.parse(req.body);
    const response = await AuthController.login(body);
    res.json(response);
}));

// GET v1/api/auth/me
authRouter.route<AuthRoute>('/me').get(...wrapAsyncHandler(authGuard, async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
    }

    const response = await AuthController.getMe(req.user.userId);
    res.json(response);
}));