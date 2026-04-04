import { z } from "zod";

export const AdminExamBodySchema = z.object({
    courseId: z.string(),
    title: z.string().min(2),
    description: z.string().optional(),
    duration: z.number().int().positive(),
    totalMarks: z.number().int().positive(),
});

export const AdminExamPatchBodySchema = AdminExamBodySchema.omit({ courseId: true }).partial();

export const AdminRandomQuestionsQuerySchema = z.object({
    count: z.coerce.number().int().positive().max(100),
    freeOnly: z.coerce.boolean().optional().default(false),
});
