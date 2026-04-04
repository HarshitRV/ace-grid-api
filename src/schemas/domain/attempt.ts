import { z } from "zod";

export const AnswerSchema = z.object({
    questionId: z.string(),
    selectedIndex: z.number().int().min(0).max(3).nullable(),
});

export type Answer = z.infer<typeof AnswerSchema>;

export const AttemptStatusSchema = z.enum(["in_progress", "completed", "expired"]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

export const AttemptSchema = z.object({
    _id: z.string(),
    userId: z.string(),
    examId: z.string(),
    answers: z.array(AnswerSchema),
    score: z.number().nullable(),
    totalMarks: z.number(),
    status: AttemptStatusSchema,
    startedAt: z.string().datetime(),
    submittedAt: z.string().datetime().nullable(),
});

export type Attempt = z.infer<typeof AttemptSchema>;

export const SubmitAttemptInputSchema = z.object({
    answers: z.array(AnswerSchema).min(1),
});

export type SubmitAttemptInput = z.infer<typeof SubmitAttemptInputSchema>;
