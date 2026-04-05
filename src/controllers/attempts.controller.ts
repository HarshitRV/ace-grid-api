import { Attempt, IAttempt } from "@/models/attempt.js";
import { Exam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import { Answer, Attempt as AttemptType, AttemptWithExam, GetAttemptByIdResponse, GetAttemptsHistoryResponse, StartAttemptResponse, SubmitAttemptResponse } from "@/schemas/index.js";
import { HttpError } from "@/utils/api-errors.js";
import mongoose from "mongoose";

type AttemptDocument = mongoose.Document<unknown, unknown, IAttempt> & IAttempt;

// Lean document shape after .populate<PopulatedExamId>()
type PopulatedAttemptLean = Omit<IAttempt, "examId"> & PopulatedExamId["examId"] extends never
    ? never
    : Omit<IAttempt, "examId"> & { examId: PopulatedExamId["examId"]; _id: mongoose.Types.ObjectId; createdAt: Date; updatedAt: Date };

type PopulatedExamId = {
    examId: {
        _id: mongoose.Types.ObjectId;
        title: string;
        courseId: mongoose.Types.ObjectId;
        duration: number;
        totalMarks: number;
    };
};

export abstract class AttemptsController {
    private static readonly MS_PER_MINUTE = 60_000;

    public static formatAttempt = (attempt: AttemptDocument): AttemptType => {
        return {
            _id: attempt._id.toString(),
            userId: attempt.userId.toString(),
            examId: attempt.examId.toString(),
            answers: attempt.answers.map((answer) => ({
                questionId: answer.questionId.toString(),
                selectedIndex: answer.selectedIndex,
            })),
            status: attempt.status,
            score: attempt.score,
            totalMarks: attempt.totalMarks,
            startedAt: attempt.startedAt.toISOString(),
            submittedAt: attempt.submittedAt?.toISOString() ?? null,
        };
    }

    private static formatPopulatedAttempt = (attempt: PopulatedAttemptLean): AttemptWithExam => ({
        _id: attempt._id.toString(),
        userId: attempt.userId.toString(),
        examId: {
            _id: attempt.examId._id.toString(),
            title: attempt.examId.title,
            courseId: attempt.examId.courseId.toString(),
            duration: attempt.examId.duration,
            totalMarks: attempt.examId.totalMarks,
        },
        answers: attempt.answers.map((answer) => ({
            questionId: answer.questionId.toString(),
            selectedIndex: answer.selectedIndex,
        })),
        score: attempt.score,
        totalMarks: attempt.totalMarks,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
    });

    /** Attempts expire at: startedAt + exam.duration(minutes) */
    private static hasAttemptExpired = (startedAt: Date, durationInMinutes: number, now = new Date()): boolean => {
        const expiresAt = startedAt.getTime() + durationInMinutes * this.MS_PER_MINUTE;
        return now.getTime() >= expiresAt;
    }

    /**
     * Mongo duplicate-key error thrown by the unique partial index on
     * (userId, examId, status='in_progress').
    */
    private static isDuplicateKeyError = (error: unknown): error is { code: number } => {
        return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
    }

    /**
     * Lazy lifecycle transition:
     * whenever the user fetches attempt history, convert any overdue
     * in-progress attempts to expired.
     */
    private static expireInProgressAttemptsForUser = async (userId: string): Promise<void> => {
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
                return this.hasAttemptExpired(new Date(attempt.startedAt), duration, now);
            })
            .map((attempt) => attempt._id);

        if (expiredAttemptIds.length === 0) return;

        await Attempt.updateMany(
            { _id: { $in: expiredAttemptIds }, status: "in_progress" },
            { $set: { status: "expired", submittedAt: now } }
        );
    }

    public static startAttempt = async ({ examId, userId }: { examId: string; userId: string }): Promise<StartAttemptResponse> => {
        const exam = await Exam.findById(examId).select("duration totalMarks");

        if (!exam) {
            throw new HttpError(404, "NOT_FOUND", "Exam not found");
        }

        // Reuse active attempt for this exam if it is still valid.
        const existing = await Attempt.findOne({
            userId,
            examId,
            status: "in_progress",
        });

        if (existing) {
            // If the stored in-progress attempt is already timed out, close it first.
            if (this.hasAttemptExpired(existing.startedAt, exam.duration)) {
                existing.status = "expired";
                existing.submittedAt = new Date();
                await existing.save();
            } else {
                return {
                    attempt: this.formatAttempt(existing)
                };
            }
        }

        const questions = await Question.find({ examId }).sort({ order: 1 }).select("_id").lean();
        if (questions.length === 0) {
            throw new HttpError(409, "CONFLICT", "This exam has no questions yet. Please try again later.");
        }

        const attempt = new Attempt({
            userId,
            examId,
            answers: questions.map((q: { _id: unknown }) => ({ questionId: q._id, selectedIndex: null })),
            totalMarks: exam.totalMarks,
        });

        try {
            await attempt.save();
            return {
                attempt: this.formatAttempt(attempt)
            };
        } catch (error) {
            if (this.isDuplicateKeyError(error)) {
                const concurrentAttempt = await Attempt.findOne({
                    userId,
                    examId,
                    status: "in_progress",
                });

                if (concurrentAttempt) {
                    return {
                        attempt: this.formatAttempt(concurrentAttempt)
                    };
                }
            }

            throw error;
        }
    }

    public static submitAnswers = async ({ attemptId, userId, answers }: { attemptId: string; userId: string; answers: Answer[] }): Promise<SubmitAttemptResponse> => {
        const attempt = await Attempt.findById(attemptId);

        if (!attempt) {
            throw new HttpError(404, "NOT_FOUND", "Attempt not found");
        }

        // 1. Enforce ownership/lifecycle guards.
        if (attempt.userId.toString() !== userId) {
            throw new HttpError(403, "FORBIDDEN", "Not authorized");
        }

        if (attempt.status === "completed") {
            throw new HttpError(409, "CONFLICT", "Attempt already submitted");
        }

        if (attempt.status === "expired") {
            throw new HttpError(409, "CONFLICT", "Attempt expired");
        }

        // 2. Re-check wall-clock expiry before scoring
        const exam = await Exam.findById(attempt.examId).select("duration").lean();

        if (!exam) {
            throw new HttpError(409, "CONFLICT", "Attempt exam no longer exists");
        }

        if (this.hasAttemptExpired(attempt.startedAt, exam.duration)) {
            attempt.status = "expired";
            attempt.submittedAt = new Date();
            await attempt.save();

            throw new HttpError(409, "CONFLICT", "Attempt expired");
        }

        // 3. Validate that submitted answers map exactly to this attempt's question set.
        // No duplicated, no missing ids, and no unexpected ids.

        const expectedQuestionIds = attempt.answers.map((answer) => answer.questionId.toString());
        const expectedSet = new Set(expectedQuestionIds);
        const incomingQuestionIds = answers.map((answer) => answer.questionId);
        const incomingSet = new Set(incomingQuestionIds);

        if (incomingSet.size !== incomingQuestionIds.length) {
            throw new HttpError(422, "VALIDATION_ERROR", "Duplicate questionId values are not allowed in answers.");
        }

        const missingQuestionIds = expectedQuestionIds.filter((id) => !incomingSet.has(id));
        const unexpectedQuestionIds = incomingQuestionIds.filter((id) => !expectedSet.has(id));

        if (missingQuestionIds.length > 0 || unexpectedQuestionIds.length > 0) {
            throw new HttpError(422, "VALIDATION_ERROR", "Answers must contain exactly the attempt's questions.");
        }

        // 4. Fetch canonical correct answers for the attempt's own exam/questions.
        const questions = await Question.find({
            examId: attempt.examId,
            _id: { $in: expectedQuestionIds },
        })
            .select("_id correctIndex")
            .lean();
        if (questions.length !== expectedSet.size) {
            throw new HttpError(409, "CONFLICT", "Attempt question set is out of sync. Start a new attempt.");
        }

        // 5. Build lookup maps for fast scoring
        // - correctMap: questionId -> correctIndex
        // - answersById: questionId -> submitted selectedIndex

        const correctMap = new Map(
            questions.map((q: { _id: { toString: () => string }; correctIndex: number | null }) => [
                q._id.toString(),
                q.correctIndex,
            ])
        );
        const answersById = new Map(
            answers.map((answer) => [answer.questionId, answer.selectedIndex] as const)
        );

        // 6 Score in the stored attempt order to keep a stable persisted answer shape.
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

        // 7) Finalize lifecycle transition: in_progress -> completed.
        attempt.answers = processedAnswers as unknown as typeof attempt.answers;
        attempt.score = score;
        attempt.status = "completed";
        attempt.submittedAt = new Date();
        await attempt.save();

        return {
            attempt: this.formatAttempt(attempt)
        }
    }

    public static getAttemptsHistory = async (userId: string): Promise<GetAttemptsHistoryResponse> => {
        await this.expireInProgressAttemptsForUser(userId);

        const attempts = await Attempt.find({ userId })
            .populate<PopulatedExamId>("examId", "title courseId duration totalMarks")
            .sort({ createdAt: -1 })
            .lean();

        return {
            attempts: attempts.map((attempt) => this.formatPopulatedAttempt(attempt)),
        };
    }

    public static getAttemptById = async ({ attemptId, userId }: { attemptId: string; userId: string }): Promise<GetAttemptByIdResponse> => {
        const attempt = await Attempt.findById(attemptId);

        if (!attempt) {
            throw new HttpError(404, "NOT_FOUND", "Attempt not found");
        }

        if (attempt.userId.toString() !== userId) {
            throw new HttpError(403, "FORBIDDEN", "Not authorized");
        }

        if (attempt.status === "in_progress") {
            // Lazy single-record expiry update on read.
            const exam = await Exam.findById(attempt.examId).select("duration").lean();
            if (exam && this.hasAttemptExpired(attempt.startedAt, exam.duration)) {
                attempt.status = "expired";
                attempt.submittedAt = new Date();
                await attempt.save();
            }
        }

        const hydratedAttempt = await Attempt.findById(attemptId)
            .populate<PopulatedExamId>("examId", "title courseId duration totalMarks")
            .lean();

        if (!hydratedAttempt) {
            throw new HttpError(404, "NOT_FOUND", "Attempt not found");
        }

        return {
            attempt: this.formatPopulatedAttempt(hydratedAttempt),
        };
    }
}