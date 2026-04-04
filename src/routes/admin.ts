import { Router } from "express";
import { z } from "zod";
import { authGuard, adminGuard, type AuthRequest } from "@/middleware/authGuard.js";
import { Course } from "@/models/Course.js";
import { Exam } from "@/models/Exam.js";
import { Question } from "@/models/Question.js";
import { sendError } from "@/utils/apiErrors.js";

export const adminRouter = Router();
adminRouter.use(authGuard, adminGuard);

// ── Validation schemas ────────────────────────────────────────────────────────

export const CourseBody = z.object({
    title: z.string().min(2, "Title must be at least 2 characters").max(50, "Title cannot exceed 50 characters"),
    slug: z.string().min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase and contain no spaces (use hyphens instead)").max(50, "Slug cannot exceed 50 characters"),
    description: z.union([
        z.string().min(10, "Description must be at least 10 characters").max(50, "Description cannot exceed 50 characters"),
        z.literal('')
    ]).optional(),
    category: z.enum([
        "government",
        "engineering",
        "medical",
        "management",
        "banking",
        "language",
        "other",
    ]),
    tags: z.array(z.string().min(2, "Tag must be at least 2 characters").max(30, "Tag cannot exceed 30 characters")).optional(),
    coverImage: z.union([
        z.url("Invalid URL"),
        z.literal('')
    ]).optional(),
});

export const CoursePutBody = z.object({
    title: z.string().min(2).max(50),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/).max(50),
    description: z.union([z.string().min(10).max(50), z.literal('')]),
    category: z.enum([
        "government",
        "engineering",
        "medical",
        "management",
        "banking",
        "language",
        "other",
    ]),
    tags: z.array(z.string().min(2).max(30)),
    coverImage: z.union([z.url(), z.literal('')]),
});


const ExamBody = z.object({
    courseId: z.string(),
    title: z.string().min(2),
    description: z.string().optional(),
    duration: z.number().int().positive(),
    totalMarks: z.number().int().positive(),
});

const QuestionBody = z.object({
    examId: z.string(),
    text: z.string().min(5),
    options: z
        .array(z.object({ index: z.number().int().min(0).max(3), text: z.string().min(1) }))
        .length(4, "Exactly 4 options required"),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().optional(),
    isFree: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().int().nonnegative().default(0),
});

const QuestionPartial = QuestionBody.omit({ examId: true }).partial();

// ── COURSES ───────────────────────────────────────────────────────────────────

// POST /api/admin/courses
adminRouter.post("/courses", async (req: AuthRequest, res, next) => {
    try {
        const body = CourseBody.parse(req.body);
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
        const body = CourseBody.partial().parse(req.body);
        const course = await Course.findByIdAndUpdate(req.params["id"], body, {
            returnDocument: 'after',
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
        const body = CourseBody.parse(req.body);
        const course = await Course.findById(req.params["id"]);
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

        course.set(body)
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
        const body = ExamBody.parse(req.body);
        const exam = await Exam.create({ ...body, questionIds: [] });
        return res.status(201).json(exam);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/exams/:id
adminRouter.patch("/exams/:id", async (req: AuthRequest, res, next) => {
    try {
        const body = ExamBody.omit({ courseId: true }).partial().parse(req.body);
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
        const { count, freeOnly } = z
            .object({
                count: z.coerce.number().int().positive().max(100),
                freeOnly: z.coerce.boolean().optional().default(false),
            })
            .parse(req.query);

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
        const body = QuestionBody.parse(req.body);

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
        const { examId, questions } = z
            .object({
                examId: z.string(),
                questions: z
                    .array(QuestionBody.omit({ examId: true }))
                    .min(1)
                    .max(500),
            })
            .parse(req.body);

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
        const body = QuestionPartial.parse(req.body);
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
