import { Router } from "express";
import { authGuard, adminGuard, type AuthRequest } from "@/middleware/auth-guard.js";
import { Course } from "@/models/course.js";
import { Exam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import { sendError } from "@/utils/api-errors.js";
import {
    AdminBulkQuestionsBodySchema,
    AdminCourseBodySchema,
    AdminCoursePatchBodySchema,
    AdminExamBodySchema,
    AdminExamPatchBodySchema,
    AdminQuestionBodySchema,
    AdminQuestionPartialSchema,
    AdminRandomQuestionsQuerySchema,
} from "@/schemas/admin/index.js";

export const adminRouter = Router();
adminRouter.use(authGuard, adminGuard);

// ── COURSES ───────────────────────────────────────────────────────────────────

// POST /api/admin/courses
adminRouter.post("/courses", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminCourseBodySchema.parse(req.body);
        const course = await Course.create(body);
        return res.status(201).json(course);
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/courses/:id
adminRouter.get("/courses/:id", async (req: AuthRequest, res, next) => {
    try {
        const course = await Course.findById(req.params["id"]).lean();
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

        const exams = await Exam.find({ courseId: course._id }).select("-questionIds").lean();

        return res.json({ ...course, exams });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/courses/:id
adminRouter.patch("/courses/:id", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminCoursePatchBodySchema.parse(req.body);
        const course = await Course.findByIdAndUpdate(req.params["id"], body, {
            returnDocument: "after",
            runValidators: true,
        });
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");
        return res.json(course);
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/courses/:id
adminRouter.put("/courses/:id", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminCourseBodySchema.parse(req.body);
        const course = await Course.findById(req.params["id"]);
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

        course.set(body);
        await course.save();

        return res.json(course);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/courses/:id  (cascades to exams → questions)
adminRouter.delete("/courses/:id", async (req: AuthRequest, res, next) => {
    try {
        const course = await Course.findById(req.params["id"]);
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

        const exams = await Exam.find({ courseId: course._id }).select("_id").lean();
        const examIds = exams.map((e) => e._id);

        await Question.deleteMany({ examId: { $in: examIds } });
        await Exam.deleteMany({ courseId: course._id });
        await course.deleteOne();

        return res.json({ message: "Course and all related content deleted." });
    } catch (err) {
        next(err);
    }
});

// ── EXAMS ─────────────────────────────────────────────────────────────────────

// POST /api/admin/exams
adminRouter.post("/exams", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminExamBodySchema.parse(req.body);
        const exam = await Exam.create({ ...body, questionIds: [] });
        return res.status(201).json(exam);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/exams/:id
adminRouter.patch("/exams/:id", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminExamPatchBodySchema.parse(req.body);
        const exam = await Exam.findByIdAndUpdate(req.params["id"], body, {
            new: true,
            runValidators: true,
        });
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");
        return res.json(exam);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/exams/:id  (cascades to questions)
adminRouter.delete("/exams/:id", async (req: AuthRequest, res, next) => {
    try {
        const exam = await Exam.findById(req.params["id"]);
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");

        await Question.deleteMany({ examId: exam._id });
        await exam.deleteOne();

        return res.json({ message: "Exam and all its questions deleted." });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/exams/:id/random?count=5&freeOnly=false
adminRouter.get("/exams/:id/random", async (req: AuthRequest, res, next) => {
    try {
        const { count, freeOnly } = AdminRandomQuestionsQuerySchema.parse(req.query);

        const filter: Record<string, unknown> = { examId: req.params["id"] };
        if (freeOnly) filter["isFree"] = true;

        const questions = await Question.aggregate([
            { $match: filter },
            { $sample: { size: count } },
            { $project: { correctIndex: 0, explanation: 0 } }, // preview only
        ]);

        return res.json({ data: questions, count: questions.length });
    } catch (err) {
        next(err);
    }
});

// ── QUESTIONS ─────────────────────────────────────────────────────────────────

// POST /api/admin/questions
adminRouter.post("/questions", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminQuestionBodySchema.parse(req.body);

        // Auto-assign order if not provided
        if (body.order === 0) {
            const count = await Question.countDocuments({ examId: body.examId });
            body.order = count;
        }

        const question = await Question.create(body);

        // Append to exam's questionIds list
        await Exam.findByIdAndUpdate(body.examId, {
            $addToSet: { questionIds: question._id },
        });

        return res.status(201).json(question);
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/questions/bulk
adminRouter.post("/questions/bulk", async (req: AuthRequest, res, next) => {
    try {
        const { examId, questions } = AdminBulkQuestionsBodySchema.parse(req.body);

        const exam = await Exam.findById(examId);
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");

        const baseOrder = await Question.countDocuments({ examId });
        const docs = questions.map((q, i) => ({
            ...q,
            examId,
            order: q.order !== 0 ? q.order : baseOrder + i,
        }));

        const created = await Question.insertMany(docs);

        await Exam.findByIdAndUpdate(examId, {
            $addToSet: { questionIds: { $each: created.map((q) => q._id) } },
        });

        return res.status(201).json({ inserted: created.length, data: created });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/questions/:id  (includes isFree toggle)
adminRouter.patch("/questions/:id", async (req: AuthRequest, res, next) => {
    try {
        const body = AdminQuestionPartialSchema.parse(req.body);
        const question = await Question.findByIdAndUpdate(req.params["id"], body, {
            new: true,
            runValidators: true,
        });
        if (!question) return sendError(res, 404, "NOT_FOUND", "Question not found");
        return res.json(question);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/questions/:id
adminRouter.delete("/questions/:id", async (req: AuthRequest, res, next) => {
    try {
        const question = await Question.findById(req.params["id"]);
        if (!question) return sendError(res, 404, "NOT_FOUND", "Question not found");

        await Exam.findByIdAndUpdate(question.examId, {
            $pull: { questionIds: question._id },
        });
        await question.deleteOne();

        return res.json({ message: "Question deleted." });
    } catch (err) {
        next(err);
    }
});
