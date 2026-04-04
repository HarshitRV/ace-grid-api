import { Router } from "express";
import { z } from "zod";
import { Exam } from "@/models/Exam.js";
import { Question } from "@/models/Question.js";
import { authGuard, type AuthRequest } from "@/middleware/authGuard.js";
import { User } from "@/models/User.js";
import { sendError } from "@/utils/apiErrors.js";

export const examsRouter = Router();

const ListExamsQuerySchema = z.object({
    courseId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

// GET /api/exams?courseId=xxx
examsRouter.get("/", async (req, res, next) => {
    try {
        const { courseId, page, limit } = ListExamsQuerySchema.parse(req.query);
        const shouldPaginate = page !== undefined || limit !== undefined;
        const pageNum = page ?? 1;
        const limitNum = limit ?? 20;
        const skip = (pageNum - 1) * limitNum;
        const filter: Record<string, unknown> = {};
        if (courseId) filter["courseId"] = courseId;

        const total = await Exam.countDocuments(filter);
        let examsQuery = Exam.find(filter).select("-questionIds");
        if (shouldPaginate) {
            examsQuery = examsQuery.skip(skip).limit(limitNum);
        }

        const exams = await examsQuery.lean();

        // Annotate with question stats
        const examIds = exams.map((e) => e._id);
        const questionStats = await Question.aggregate([
            { $match: { examId: { $in: examIds } } },
            {
                $group: {
                    _id: "$examId",
                    total: { $sum: 1 },
                    free: { $sum: { $cond: ["$isFree", 1, 0] } },
                },
            },
        ]);
        const statsMap = new Map(
            questionStats.map((s: { _id: string; total: number; free: number }) => [
                s._id.toString(),
                { total: s.total, free: s.free },
            ])
        );

        const examsWithStats = exams.map((e) => ({
            ...e,
            questionCount: statsMap.get(e._id.toString())?.total ?? 0,
            freeQuestionCount: statsMap.get(e._id.toString())?.free ?? 0,
        }));

        const pageSize = shouldPaginate ? limitNum : total === 0 ? 1 : total;
        const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

        return res.json({
            data: examsWithStats,
            total,
            page: pageNum,
            limit: shouldPaginate ? limitNum : total,
            totalPages,
            pagination: {
                page: pageNum,
                pageSize: shouldPaginate ? limitNum : total,
                totalItems: total,
                totalPages,
            },
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/exams/:id — requires auth; gates non-free questions
examsRouter.get("/:id", authGuard, async (req: AuthRequest, res, next) => {
    try {
        const exam = await Exam.findById(req.params["id"]).lean();
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");

        const questions = await Question.find({ examId: exam._id }).sort({ order: 1 }).lean();

        // Check if user has purchased this exam
        const user = await User.findById(req.user!.userId).select("purchasedExams").lean();
        const hasPurchased = user?.purchasedExams
            .map((id: { toString: () => string }) => id.toString())
            .includes(exam._id.toString());

        // Gate: redact correctIndex and explanation for non-free, non-purchased questions
        const sanitizedQuestions = questions.map((q) => {
            if (q.isFree || hasPurchased) {
                return {
                    _id: q._id,
                    examId: q.examId,
                    text: q.text,
                    options: q.options,
                    correctIndex: q.correctIndex,
                    explanation: q.explanation ?? null,
                    isFree: q.isFree,
                    tags: q.tags,
                    order: q.order,
                };
            }
            // Gated: return stub
            return {
                _id: q._id,
                examId: q.examId,
                text: q.text,
                options: q.options,
                correctIndex: null,
                explanation: null,
                isFree: false,
                tags: q.tags,
                order: q.order,
            };
        });

        return res.json({
            exam: {
                ...exam,
                questionCount: questions.length,
                freeQuestionCount: questions.filter((q) => q.isFree).length,
            },
            questions: sanitizedQuestions,
        });
    } catch (err) {
        next(err);
    }
});
