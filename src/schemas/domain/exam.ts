import { z } from "zod";

export const ExamSchema = z.object({
    _id: z.string(),
    title: z.string(),
    courseId: z.string(),
    description: z.string().optional(),
    duration: z.number().int().positive().describe("Duration in minutes"),
    totalMarks: z.number().int().positive(),
    questionCount: z.number().int().nonnegative(),
    freeQuestionCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Exam = z.infer<typeof ExamSchema>;
