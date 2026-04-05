import { Router } from "express";
import { z } from "zod";
import { authGuard } from "@/middleware/auth-guard.js";
import { HttpError } from "@/utils/api-errors.js";
import { AttemptRoute, StartAttemptInputSchema, SubmitAttemptInputSchema } from "@/schemas/index.js";
import { AttemptsController } from "@/controllers/attempts.controller.js";
import { handleAsyncError } from "@/utils/handler-async-error.js";

export const attemptsRouter = Router();
attemptsRouter.use(handleAsyncError(authGuard));

// POST v1/api/attempts — start an attempt
attemptsRouter.route<AttemptRoute>('/').post(handleAsyncError(async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { examId } = StartAttemptInputSchema.parse(req.body);
    const response = await AttemptsController.startAttempt({ examId, userId: req.user.userId });
    res.status(200).json(response);
}));

// PATCH v1/api/attempts/:id/submit — submit answers and calculate score
attemptsRouter.route<AttemptRoute>('/:id/submit').patch(handleAsyncError(async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id: attemptId } = z.object({ id: z.string() }).parse(req.params);
    const { answers } = SubmitAttemptInputSchema.parse(req.body);
    const response = await AttemptsController.submitAnswers({ attemptId, userId: req.user.userId, answers })
    res.status(200).json(response);
}));

// GET v1/api/attempts/me — user's attempt history
attemptsRouter.route<AttemptRoute>('/me').get(handleAsyncError(async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const response = await AttemptsController.getAttemptsHistory(req.user.userId);
    res.status(200).json(response);
}));

// GET v1/api/attempts/:id
attemptsRouter.route<AttemptRoute>('/:id').get(handleAsyncError(async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const { id: attemptId } = z.object({ id: z.string() }).parse(req.params);

    const response = await AttemptsController.getAttemptById({ attemptId, userId: req.user.userId });
    res.status(200).json(response);
}));
