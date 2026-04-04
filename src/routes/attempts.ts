import { Router } from "express";
import { z } from "zod";
import { authGuard, type AuthRequest } from "@/middleware/authGuard.js";
import { Attempt } from "@/models/Attempt.js";
import { Exam } from "@/models/Exam.js";
import { Question } from "@/models/Question.js";
import { sendError } from "@/utils/apiErrors.js";

export const attemptsRouter = Router();
attemptsRouter.use(authGuard);

// POST /api/attempts — start an attempt
attemptsRouter.post("/", async (req: AuthRequest, res, next) => {
    try {
        const { examId } = z.object({ examId: z.string() }).parse(req.body);

        const exam = await Exam.findById(examId);
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");

        // Prevent multiple active attempts on the same exam
        const existing = await Attempt.findOne({
            userId: req.user!.userId,
            examId,
            status: "in_progress",
        });
        if (existing) {
            return res.json(existing); // Resume existing attempt
        }

        const questions = await Question.find({ examId }).sort({ order: 1 }).select("_id").lean();
        if (questions.length === 0) {
            return sendError(
                res,
                409,
                "CONFLICT",
                "This exam has no questions yet. Please try again later."
            );
        }

        const attempt = new Attempt({
            userId: req.user!.userId,
            examId,
            answers: questions.map((q: { _id: unknown }) => ({ questionId: q._id, selectedIndex: null })),
            totalMarks: exam.totalMarks,
        });
        await attempt.save();

        return res.status(201).json(attempt);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/attempts/:id/submit — submit answers and calculate score
attemptsRouter.patch("/:id/submit", async (req: AuthRequest, res, next) => {
    try {
        const AnswersSchema = z.object({
            answers: z.array(
                z.object({
                    questionId: z.string(),
                    selectedIndex: z.number().int().min(0).max(3).nullable(),
                })
            )
            .min(1),
        });
        const { answers } = AnswersSchema.parse(req.body);

        const attempt = await Attempt.findById(req.params["id"]);
        if (!attempt) return sendError(res, 404, "NOT_FOUND", "Attempt not found");
        if (attempt.userId.toString() !== req.user!.userId) {
            return sendError(res, 403, "FORBIDDEN", "Not authorized");
        }
        if (attempt.status !== "in_progress") {
            return sendError(res, 409, "CONFLICT", "Attempt already submitted");
        }

        const expectedQuestionIds = attempt.answers.map((answer) => answer.questionId.toString());
        const expectedSet = new Set(expectedQuestionIds);
        const incomingQuestionIds = answers.map((answer) => answer.questionId);
        const incomingSet = new Set(incomingQuestionIds);

        if (incomingSet.size !== incomingQuestionIds.length) {
            return sendError(
                res,
                422,
                "VALIDATION_ERROR",
                "Duplicate questionId values are not allowed in answers."
            );
        }

        const missingQuestionIds = expectedQuestionIds.filter((id) => !incomingSet.has(id));
        const unexpectedQuestionIds = incomingQuestionIds.filter((id) => !expectedSet.has(id));
        if (missingQuestionIds.length > 0 || unexpectedQuestionIds.length > 0) {
            return sendError(
                res,
                422,
                "VALIDATION_ERROR",
                "Answers must contain exactly the attempt's questions.",
                { missingQuestionIds, unexpectedQuestionIds }
            );
        }

        // Calculate score against the attempt's original question set.
        const questions = await Question.find({
            examId: attempt.examId,
            _id: { $in: expectedQuestionIds },
        })
            .select("_id correctIndex")
            .lean();
        if (questions.length !== expectedSet.size) {
            return sendError(
                res,
                409,
                "CONFLICT",
                "Attempt question set is out of sync. Start a new attempt."
            );
        }
        const correctMap = new Map(
            questions.map((q: { _id: { toString: () => string }; correctIndex: number | null }) => [
                q._id.toString(),
                q.correctIndex,
            ])
        );
        const answersById = new Map(
            answers.map((answer) => [answer.questionId, answer.selectedIndex] as const)
        );

        let correct = 0;
        const processedAnswers = attempt.answers.map((answer) => {
            const questionId = answer.questionId.toString();
            const selectedIndex = answersById.get(questionId) ?? null;
            const correctIndex = correctMap.get(questionId);

            if (selectedIndex !== null && selectedIndex === correctIndex) correct++;
            return { questionId: answer.questionId, selectedIndex };
        });

        const marksPerQuestion = attempt.totalMarks / expectedSet.size;
        const score = Math.round(correct * marksPerQuestion * 100) / 100;

        attempt.answers = processedAnswers as unknown as typeof attempt.answers;
        attempt.score = score;
        attempt.status = "completed";
        attempt.submittedAt = new Date();
        await attempt.save();

        return res.json(attempt);
    } catch (err) {
        next(err);
    }
});

// GET /api/attempts/me — user's attempt history
attemptsRouter.get("/me", async (req: AuthRequest, res, next) => {
    try {
        const attempts = await Attempt.find({ userId: req.user!.userId })
            .populate("examId", "title courseId duration totalMarks")
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ data: attempts });
    } catch (err) {
        next(err);
    }
});

// GET /api/attempts/:id
attemptsRouter.get("/:id", async (req: AuthRequest, res, next) => {
    try {
        const attempt = await Attempt.findById(req.params["id"])
            .populate("examId", "title duration totalMarks")
            .lean();
        if (!attempt) return sendError(res, 404, "NOT_FOUND", "Attempt not found");
        if (attempt.userId.toString() !== req.user!.userId) {
            return sendError(res, 403, "FORBIDDEN", "Not authorized");
        }
        return res.json(attempt);
    } catch (err) {
        next(err);
    }
});
