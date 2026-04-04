import { z } from "zod";

const AdminQuestionOptionSchema = z.object({
    index: z.number().int().min(0).max(3),
    text: z.string().min(1),
});

export const AdminQuestionBodySchema = z.object({
    examId: z.string(),
    text: z.string().min(5),
    options: z.array(AdminQuestionOptionSchema).length(4, "Exactly 4 options required"),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().optional(),
    isFree: z.boolean().default(true),
    tags: z.array(z.string()).default([]),
    order: z.number().int().nonnegative().default(0),
});

export const AdminQuestionPartialSchema = AdminQuestionBodySchema.omit({ examId: true }).partial();

export const AdminBulkQuestionsBodySchema = z.object({
    examId: z.string(),
    questions: z.array(AdminQuestionBodySchema.omit({ examId: true })).min(1).max(500),
});
