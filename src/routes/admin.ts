import { Router } from "express";
import { authGuard, adminGuard } from "@/middleware/auth-guard.js";
import { handleAsyncError } from "@/utils/handler-async-error.js";
import {
    CourseBodySchema,
    GetCourseByIdParamsSchema,
    PatchCourseBodySchema,
    AdminExamIdParamsSchema,
    AdminCreateExamBodySchema,
    AdminPatchExamBodySchema,
    AdminRandomQuestionsQuerySchema,
    AdminQuestionIdParamsSchema,
    AdminCreateQuestionBodySchema,
    AdminPatchQuestionBodySchema,
    AdminBulkCreateQuestionsBodySchema,
    AdminRoute
} from "@/schemas/index.js";
import { CourseController } from "@/controllers/course.controller.js";
import { ExamController } from "@/controllers/exam.controller.js";
import { QuestionController } from "@/controllers/question.controller.js";

export const adminRouter = Router();
adminRouter.use(handleAsyncError(authGuard), adminGuard);

// ── COURSES ───────────────────────────────────────────────────────────────────
// GET /api/admin/courses
adminRouter.route<AdminRoute>("/courses").get(handleAsyncError(async (req, res, _next) => {
    const body = CourseBodySchema.parse(req.body);
    const response = await CourseController.addCourse(body);
    res.status(201).json(response);
}));

// POST /api/admin/courses
adminRouter.route<AdminRoute>("/courses").post(handleAsyncError(async (req, res, _next) => {
    const body = CourseBodySchema.parse(req.body);
    const response = await CourseController.addCourse(body);
    res.status(201).json(response);
}));

// GET /api/admin/courses/:id
adminRouter.route<AdminRoute>("/courses/:id").get(handleAsyncError(async (req, res, _next) => {
    const { id } = GetCourseByIdParamsSchema.parse(req.params);
    const response = await CourseController.getCourseById(id);
    res.status(200).json(response);
}));

// PATCH /api/admin/courses/:id
adminRouter.route<AdminRoute>("/courses/:id").patch(handleAsyncError(async (req, res, _next) => {
    const { id: courseId } = GetCourseByIdParamsSchema.parse(req.params);
    const body = PatchCourseBodySchema.parse(req.body);
    const response = await CourseController.patchCourse({ courseId, body });
    res.status(200).json(response);
}));

// PUT /api/admin/courses/:id
adminRouter.route<AdminRoute>("/courses/:id").put(handleAsyncError(async (req, res, _next) => {
    const { id: courseId } = GetCourseByIdParamsSchema.parse(req.params);
    const body = CourseBodySchema.parse(req.body);
    const response = await CourseController.updateCourse({ courseId, body });
    res.status(200).json(response);
}));

// DELETE /api/admin/courses/:id  (cascades to exams → questions)
adminRouter.route<AdminRoute>("/courses/:id").delete(handleAsyncError(async (req, res, _next) => {
    const { id: courseId } = GetCourseByIdParamsSchema.parse(req.params);
    await CourseController.deleteCourseWithRelatedEntities(courseId);
    res.status(200).json({ message: "Course and all related content deleted." });
}));

// ── EXAMS ─────────────────────────────────────────────────────────────────────

// POST /api/admin/exams
adminRouter.route<AdminRoute>("/exams").post(handleAsyncError(async (req, res, _next) => {
    const body = AdminCreateExamBodySchema.parse(req.body);
    const response = await ExamController.createExam(body);
    res.status(201).json(response);
}));

// PATCH /api/admin/exams/:id
adminRouter.route<AdminRoute>("/exams/:id").patch(handleAsyncError(async (req, res, _next) => {
    const { id: examId } = AdminExamIdParamsSchema.parse(req.params);
    const body = AdminPatchExamBodySchema.parse(req.body);
    const response = await ExamController.patchExam({ examId, body });
    res.status(200).json(response);
}));

// DELETE /api/admin/exams/:id  (cascades to questions)
adminRouter.route<AdminRoute>("/exams/:id").delete(handleAsyncError(async (req, res, _next) => {
    const { id: examId } = AdminExamIdParamsSchema.parse(req.params);
    await ExamController.deleteExamWithQuestions(examId);
    res.status(200).json({ message: "Exam and all its questions deleted." });
}));

// GET /api/admin/exams/:id/random?count=5&freeOnly=false
adminRouter.route<AdminRoute>("/exams/:id/random").get(handleAsyncError(async (req, res, _next) => {
    const { id: examId } = AdminExamIdParamsSchema.parse(req.params);
    const { count, freeOnly } = AdminRandomQuestionsQuerySchema.parse(req.query);
    const response = await ExamController.getRandomQuestions({ examId, count, freeOnly });
    res.status(200).json(response);
}));

// ── QUESTIONS ─────────────────────────────────────────────────────────────────

// POST /api/admin/questions
adminRouter.route<AdminRoute>("/questions").post(handleAsyncError(async (req, res, _next) => {
    const body = AdminCreateQuestionBodySchema.parse(req.body);
    const response = await QuestionController.createQuestion(body);
    res.status(201).json(response);
}));

// POST /api/admin/questions/bulk
adminRouter.route<AdminRoute>("/questions/bulk").post(handleAsyncError(async (req, res, _next) => {
    const body = AdminBulkCreateQuestionsBodySchema.parse(req.body);
    const response = await QuestionController.bulkCreateQuestions(body);
    res.status(201).json(response);
}));

// PATCH /api/admin/questions/:id  (includes isFree toggle)
adminRouter.route<AdminRoute>("/questions/:id").patch(handleAsyncError(async (req, res, _next) => {
    const { id: questionId } = AdminQuestionIdParamsSchema.parse(req.params);
    const body = AdminPatchQuestionBodySchema.parse(req.body);
    const response = await QuestionController.patchQuestion({ questionId, body });
    res.status(200).json(response);
}));

// DELETE /api/admin/questions/:id
adminRouter.route<AdminRoute>("/questions/:id").delete(handleAsyncError(async (req, res, _next) => {
    const { id: questionId } = AdminQuestionIdParamsSchema.parse(req.params);
    await QuestionController.deleteQuestion(questionId);
    res.status(200).json({ message: "Question deleted." });
}));
