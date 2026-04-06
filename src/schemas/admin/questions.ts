import { z } from "zod";
import { QuestionSchema } from "@/schemas/domain/question.js";

export const AdminQuestionIdParamsSchema = z.object({
    id: z.string(),
});
export type AdminQuestionIdParams = z.infer<typeof AdminQuestionIdParamsSchema>;

const AdminQuestionOptionSchema = z.object({
    index: z.number().int().min(0).max(3),
    text: z.string().min(1),
});

export const AdminCreateQuestionBodySchema = z.object({
    examId: z.string(),
    text: z.string().min(5),
    options: z.array(AdminQuestionOptionSchema).length(4, "Exactly 4 options required"),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().optional(),
    isFree: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().int().nonnegative().default(0),
});
export type AdminCreateQuestionBody = z.infer<typeof AdminCreateQuestionBodySchema>;

export const AdminPatchQuestionBodySchema = AdminCreateQuestionBodySchema.omit({ examId: true }).partial();
export type AdminPatchQuestionBody = z.infer<typeof AdminPatchQuestionBodySchema>;

export const AdminBulkCreateQuestionsBodySchema = z.object({
    examId: z.string(),
    questions: z.array(AdminCreateQuestionBodySchema.omit({ examId: true })).min(1).max(500),
});
export type AdminBulkCreateQuestionsBody = z.infer<typeof AdminBulkCreateQuestionsBodySchema>;

export const AdminCreateQuestionResponseSchema = z.object({
    question: QuestionSchema,
});
export type AdminCreateQuestionResponse = z.infer<typeof AdminCreateQuestionResponseSchema>;

export const AdminBulkCreateQuestionsResponseSchema = z.object({
    inserted: z.number().int().nonnegative(),
    data: z.array(QuestionSchema),
});
export type AdminBulkCreateQuestionsResponse = z.infer<typeof AdminBulkCreateQuestionsResponseSchema>;

export const AdminPatchQuestionResponseSchema = z.object({
    question: QuestionSchema,
});
export type AdminPatchQuestionResponse = z.infer<typeof AdminPatchQuestionResponseSchema>;

export const AdminDeleteQuestionResponseSchema = z.object({
    message: z.string(),
});
export type AdminDeleteQuestionResponse = z.infer<typeof AdminDeleteQuestionResponseSchema>;
