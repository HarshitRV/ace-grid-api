import { Exam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import type {
    AdminCreateQuestionBody,
    AdminCreateQuestionResponse,
    AdminBulkCreateQuestionsBody,
    AdminBulkCreateQuestionsResponse,
    AdminPatchQuestionBody,
    AdminPatchQuestionResponse,
} from "@/schemas/admin/questions.js";
import type { Question as QuestionType } from "@/schemas/domain/question.js";
import { HttpError } from "@/utils/api-errors.js";

export abstract class QuestionController {
    /**
     * Formats a raw Question document/object into the public schema format.
     */
    private static formatQuestion(question: {
        _id: { toString(): string };
        examId: { toString(): string };
        text: string;
        options: { index: number; text: string }[];
        correctIndex: number;
        explanation?: string;
        isFree: boolean;
        tags: string[];
        order: number;
    }): QuestionType {
        return {
            _id: question._id.toString(),
            examId: question.examId.toString(),
            text: question.text,
            options: question.options,
            correctIndex: question.correctIndex,
            explanation: question.explanation ?? null,
            isFree: question.isFree,
            tags: question.tags,
            order: question.order,
        };
    }

    /** Creates a question and appends it to the parent exam's `questionIds`. */
    public static createQuestion = async (body: AdminCreateQuestionBody): Promise<AdminCreateQuestionResponse> => {
        if (body.order === 0) {
            const count = await Question.countDocuments({ examId: body.examId });
            body.order = count;
        }

        const question = await Question.create(body);

        await Exam.findByIdAndUpdate(body.examId, {
            $addToSet: { questionIds: question._id },
        });

        return { question: this.formatQuestion(question) };
    };

    /** Inserts many questions at once, auto-assigning order when `order === 0`. */
    public static bulkCreateQuestions = async ({
        examId,
        questions,
    }: AdminBulkCreateQuestionsBody): Promise<AdminBulkCreateQuestionsResponse> => {
        const exam = await Exam.findById(examId);
        if (!exam) {
            throw new HttpError(404, "NOT_FOUND", "Exam not found");
        }

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

        return {
            inserted: created.length,
            data: created.map((q) => this.formatQuestion(q)),
        };
    };

    /**
     * Updates an existing question. Can optionally toggle its isFree status.
     */
    public static patchQuestion = async ({
        questionId,
        body,
    }: {
        questionId: string;
        body: AdminPatchQuestionBody;
    }): Promise<AdminPatchQuestionResponse> => {
        const question = await Question.findByIdAndUpdate(questionId, body, {
            new: true,
            runValidators: true,
        });
        if (!question) {
            throw new HttpError(404, "NOT_FOUND", "Question not found");
        }
        return { question: this.formatQuestion(question) };
    };

    /** Deletes a question and removes it from the parent exam's `questionIds`. */
    public static deleteQuestion = async (questionId: string): Promise<void> => {
        const question = await Question.findById(questionId);
        if (!question) {
            throw new HttpError(404, "NOT_FOUND", "Question not found");
        }

        await Exam.findByIdAndUpdate(question.examId, {
            $pull: { questionIds: question._id },
        });
        await question.deleteOne();
    };
}
