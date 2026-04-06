import { Router } from "express";
import { authGuard } from "@/middleware/auth-guard.js";
import { HttpError } from "@/utils/api-errors.js";
import { handleAsyncError } from "@/utils/handler-async-error.js";
import { ExamIdParamsSchema, ExamRoute, ListExamsQuerySchema } from "@/schemas/index.js";
import { ExamController } from "@/controllers/exam.controller.js";

export const examsRouter = Router();

// GET /api/exams?courseId=xxx
examsRouter.route<ExamRoute>('/').get(handleAsyncError(async (req, res, _next) => {
    const query = ListExamsQuerySchema.parse(req.query);
    const response = await ExamController.listExams(query);
    res.status(200).json(response);
}));

// GET /api/exams/:id — requires auth; gates non-free questions
examsRouter.route<ExamRoute>('/:id').get(handleAsyncError(authGuard), handleAsyncError(async (req, res, _next) => {
    if (!req.user) {
        throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
    }

    const { id: examId } = ExamIdParamsSchema.parse(req.params);
    const response = await ExamController.getExamById({ examId, userId: req.user.userId });
    res.status(200).json(response);
}));
