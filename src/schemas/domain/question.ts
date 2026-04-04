import { z } from "zod";

export const QuestionOptionSchema = z.object({
    index: z.number().int().min(0).max(3),
    text: z.string(),
});

export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionSchema = z.object({
    _id: z.string(),
    examId: z.string(),
    text: z.string(),
    options: z.array(QuestionOptionSchema).length(4),
    correctIndex: z.number().int().min(0).max(3).nullable(),
    explanation: z.string().nullable(),
    isFree: z.boolean(),
    tags: z.array(z.string()),
    order: z.number().int().nonnegative(),
});

export type Question = z.infer<typeof QuestionSchema>;
