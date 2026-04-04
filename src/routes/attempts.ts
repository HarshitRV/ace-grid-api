import { Router } from "express";
import { z } from "zod";
import { authGuard, type AuthRequest } from "@/middleware/auth-guard.js";
import { Attempt } from "@/models/attempt.js";
import { Exam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import { sendError } from "@/utils/api-errors.js";

export const attemptsRouter = Router();
attemptsRouter.use(authGuard);

const MS_PER_MINUTE = 60_000;

/**
 * Attempts expire at: startedAt + exam.duration(minutes).
 */
function hasAttemptExpired(startedAt: Date, durationInMinutes: number, now = new Date()): boolean {
    const expiresAt = startedAt.getTime() + durationInMinutes * MS_PER_MINUTE;
    return now.getTime() >= expiresAt;
}

/**
 * Mongo duplicate-key error thrown by the unique partial index on
 * (userId, examId, status='in_progress').
 */
function isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

/**
 * Lazy lifecycle transition:
 * whenever the user fetches attempt history, convert any overdue
 * in-progress attempts to expired.
 */
async function expireInProgressAttemptsForUser(userId: string) {
    const activeAttempts = await Attempt.find({ userId, status: "in_progress" })
        .select("_id examId startedAt")
        .lean();
    if (activeAttempts.length === 0) return;

    const examIds = [...new Set(activeAttempts.map((attempt) => attempt.examId.toString()))];
    const exams = await Exam.find({ _id: { $in: examIds } }).select("_id duration").lean();
    const examDurationMap = new Map(exams.map((exam) => [exam._id.toString(), exam.duration]));
    const now = new Date();

    const expiredAttemptIds = activeAttempts
        .filter((attempt) => {
            const duration = examDurationMap.get(attempt.examId.toString());
            if (duration === undefined) return false;
            return hasAttemptExpired(new Date(attempt.startedAt), duration, now);
        })
        .map((attempt) => attempt._id);

    if (expiredAttemptIds.length === 0) return;

    await Attempt.updateMany(
        { _id: { $in: expiredAttemptIds }, status: "in_progress" },
        { $set: { status: "expired", submittedAt: now } }
    );
}

// POST /api/attempts — start an attempt
attemptsRouter.post("/", async (req: AuthRequest, res, next) => {
    try {
        const { examId } = z.object({ examId: z.string() }).parse(req.body);

        const exam = await Exam.findById(examId).select("duration totalMarks");
        if (!exam) return sendError(res, 404, "NOT_FOUND", "Exam not found");

        // Reuse active attempt for this exam if it is still valid.
        const existing = await Attempt.findOne({
            userId: req.user!.userId,
            examId,
            status: "in_progress",
        });
        if (existing) {
            // If the stored in-progress attempt is already timed out, close it first.
            if (hasAttemptExpired(existing.startedAt, exam.duration)) {
                existing.status = "expired";
                existing.submittedAt = new Date();
                await existing.save();
            } else {
                return res.json(existing); // Resume existing attempt
            }
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

        try {
            await attempt.save();
            return res.status(201).json(attempt);
        } catch (error) {
            // Two start requests can race:
            // request A and B both see "no active attempt", then both try to insert.
            // The unique index lets only one insert win. For the loser, fetch and return
            // the winning in-progress attempt so the client still gets a usable response.
            if (isDuplicateKeyError(error)) {
                const concurrentAttempt = await Attempt.findOne({
                    userId: req.user!.userId,
                    examId,
                    status: "in_progress",
                });

                if (concurrentAttempt) {
                    return res.json(concurrentAttempt);
                }
            }

            throw error;
        }
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
            ).min(1),
        });
        const { answers } = AnswersSchema.parse(req.body);

        const attempt = await Attempt.findById(req.params["id"]);
        if (!attempt) return sendError(res, 404, "NOT_FOUND", "Attempt not found");
        if (attempt.userId.toString() !== req.user!.userId) {
            return sendError(res, 403, "FORBIDDEN", "Not authorized");
        }
        if (attempt.status === "completed") {
            return sendError(res, 409, "CONFLICT", "Attempt already submitted");
        }
        if (attempt.status === "expired") {
            return sendError(res, 409, "CONFLICT", "Attempt expired");
        }

        // Even if DB says in_progress, verify it against current time before scoring.
        const exam = await Exam.findById(attempt.examId).select("duration").lean();
        if (!exam) {
            return sendError(res, 409, "CONFLICT", "Attempt exam no longer exists");
        }
        if (hasAttemptExpired(attempt.startedAt, exam.duration)) {
            attempt.status = "expired";
            attempt.submittedAt = new Date();
            await attempt.save();
            return sendError(res, 409, "CONFLICT", "Attempt expired");
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
        // Keep statuses accurate before returning list data.
        await expireInProgressAttemptsForUser(req.user!.userId);

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
        const attempt = await Attempt.findById(req.params["id"]);
        if (!attempt) return sendError(res, 404, "NOT_FOUND", "Attempt not found");
        if (attempt.userId.toString() !== req.user!.userId) {
            return sendError(res, 403, "FORBIDDEN", "Not authorized");
        }

        if (attempt.status === "in_progress") {
            // Lazy single-record expiry update on read.
            const exam = await Exam.findById(attempt.examId).select("duration").lean();
            if (exam && hasAttemptExpired(attempt.startedAt, exam.duration)) {
                attempt.status = "expired";
                attempt.submittedAt = new Date();
                await attempt.save();
            }
        }

        const hydratedAttempt = await Attempt.findById(req.params["id"])
            .populate("examId", "title duration totalMarks")
            .lean();

        return res.json(hydratedAttempt);
    } catch (err) {
        next(err);
    }
});
