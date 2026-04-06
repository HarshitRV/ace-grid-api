import { Exam, type IExam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import { User } from "@/models/user.js";
import type {
    AdminCreateExamBody,
    AdminCreateExamResponse,
    AdminExam,
    AdminPatchExamBody,
    AdminPatchExamResponse,
    AdminRandomQuestionsQuery,
    AdminRandomQuestionsResponse,
} from "@/schemas/admin/exams.js";
import type {
    GetExamResponse,
    ListExamsQuery,
    ListExamsResponse,
    Exam as ExamType,
} from "@/schemas/domain/exam.js";
import type { Question as QuestionType } from "@/schemas/domain/question.js";
import { HttpError } from "@/utils/api-errors.js";
import type mongoose from "mongoose";

type ExamDocument = IExam & { _id: mongoose.Types.ObjectId; __v: number };

export abstract class ExamController {
    /** Formats a Mongoose exam document into the admin API shape (no question stats). */
    private static formatAdminExam(exam: ExamDocument): AdminExam {
        return {
            _id: exam._id.toString(),
            title: exam.title,
            courseId: exam.courseId.toString(),
            description: exam.description,
            duration: exam.duration,
            totalMarks: exam.totalMarks,
            createdAt: exam.createdAt.toISOString(),
            updatedAt: exam.updatedAt.toISOString(),
        };
    }

    public static createExam = async (body: AdminCreateExamBody): Promise<AdminCreateExamResponse> => {
        const exam = await Exam.create({ ...body, questionIds: [] });
        return { exam: this.formatAdminExam(exam) };
    };

    public static patchExam = async ({
        examId,
        body,
    }: {
        examId: string;
        body: AdminPatchExamBody;
    }): Promise<AdminPatchExamResponse> => {
        const exam = await Exam.findByIdAndUpdate(examId, body, {
            new: true,
            runValidators: true,
        });
        if (!exam) {
            throw new HttpError(404, "NOT_FOUND", "Exam not found");
        }
        return { exam: this.formatAdminExam(exam) };
    };

    /** Deletes an exam and all its questions. */
    public static deleteExamWithQuestions = async (examId: string): Promise<void> => {
        const exam = await Exam.findById(examId);
        if (!exam) {
            throw new HttpError(404, "NOT_FOUND", "Exam not found");
        }

        await Question.deleteMany({ examId: exam._id });
        await exam.deleteOne();
    };

    /** Returns a random sample of questions for an exam (preview-only, no answers). */
    public static getRandomQuestions = async ({
        examId,
        count,
        freeOnly,
    }: AdminRandomQuestionsQuery & { examId: string }): Promise<AdminRandomQuestionsResponse> => {
        const filter: Record<string, unknown> = { examId };
        if (freeOnly) filter["isFree"] = true;

        const questions = await Question.aggregate([
            { $match: filter },
            { $sample: { size: count } },
            { $project: { correctIndex: 0, explanation: 0 } },
        ]);

        return { data: questions, count: questions.length };
    };

    /**
     * Lists exams with question stats (total / free counts).
     * Pagination is optional — omitting `page`/`limit` returns all results.
     */
    public static listExams = async ({
        courseId,
        page,
        limit,
    }: ListExamsQuery): Promise<ListExamsResponse> => {
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

        const examsWithStats: ExamType[] = exams.map((e) => ({
            _id: e._id.toString(),
            title: e.title,
            courseId: e.courseId.toString(),
            description: e.description,
            duration: e.duration,
            totalMarks: e.totalMarks,
            questionCount: statsMap.get(e._id.toString())?.total ?? 0,
            freeQuestionCount: statsMap.get(e._id.toString())?.free ?? 0,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
        }));

        const pageSize = shouldPaginate ? limitNum : total === 0 ? 1 : total;
        const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

        return {
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
        };
    };

    /**
     * Returns an exam with its questions.
     * Non-free questions are redacted (correctIndex/explanation nulled) unless the user has purchased the exam.
     */
    public static getExamById = async ({
        examId,
        userId,
    }: {
        examId: string;
        userId: string;
    }): Promise<GetExamResponse> => {
        const exam = await Exam.findById(examId).lean();
        if (!exam) {
            throw new HttpError(404, "NOT_FOUND", "Exam not found");
        }

        const questions = await Question.find({ examId: exam._id }).sort({ order: 1 }).lean();

        const user = await User.findById(userId).select("purchasedExams").lean();
        const hasPurchased = user?.purchasedExams
            .map((id: { toString: () => string }) => id.toString())
            .includes(exam._id.toString());

        const sanitizedQuestions: QuestionType[] = questions.map((q) => {
            const base = {
                _id: q._id.toString(),
                examId: q.examId.toString(),
                text: q.text,
                options: q.options,
                isFree: q.isFree,
                tags: q.tags,
                order: q.order,
            };

            if (q.isFree || hasPurchased) {
                return {
                    ...base,
                    correctIndex: q.correctIndex,
                    explanation: q.explanation ?? null,
                };
            }

            return {
                ...base,
                correctIndex: null,
                explanation: null,
            };
        });

        return {
            exam: {
                _id: exam._id.toString(),
                title: exam.title,
                courseId: exam.courseId.toString(),
                description: exam.description,
                duration: exam.duration,
                totalMarks: exam.totalMarks,
                questionCount: questions.length,
                freeQuestionCount: questions.filter((q) => q.isFree).length,
                createdAt: exam.createdAt.toISOString(),
                updatedAt: exam.updatedAt.toISOString(),
            },
            questions: sanitizedQuestions,
        };
    };
}
