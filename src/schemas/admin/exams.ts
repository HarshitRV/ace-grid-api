import { z } from "zod";

export const AdminExamIdParamsSchema = z.object({
    id: z.string(),
});
export type AdminExamIdParams = z.infer<typeof AdminExamIdParamsSchema>;

export const AdminCreateExamBodySchema = z.object({
    courseId: z.string().min(1, 'Please select a course'),
    title: z.string().min(2),
    description: z.string().optional(),
    duration: z.number().int().positive().describe('Duration in minutes'), // mins
    totalMarks: z.number().int().positive(),
});
export type AdminCreateExamBody = z.infer<typeof AdminCreateExamBodySchema>;

export const AdminPatchExamBodySchema = AdminCreateExamBodySchema.omit({ courseId: true }).partial();
export type AdminPatchExamBody = z.infer<typeof AdminPatchExamBodySchema>;

/** Shape of an exam in admin API responses (no question stats). */
export const AdminExamSchema = z.object({
    _id: z.string(),
    title: z.string(),
    courseId: z.string(),
    description: z.string().optional(),
    duration: z.number().int().positive(),
    totalMarks: z.number().int().positive(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export type AdminExam = z.infer<typeof AdminExamSchema>;

export const AdminCreateExamResponseSchema = z.object({
    exam: AdminExamSchema,
});
export type AdminCreateExamResponse = z.infer<typeof AdminCreateExamResponseSchema>;

export const AdminPatchExamResponseSchema = z.object({
    exam: AdminExamSchema,
});
export type AdminPatchExamResponse = z.infer<typeof AdminPatchExamResponseSchema>;

export const AdminDeleteExamResponseSchema = z.object({
    message: z.string(),
});
export type AdminDeleteExamResponse = z.infer<typeof AdminDeleteExamResponseSchema>;

export const AdminRandomQuestionsQuerySchema = z.object({
    count: z.coerce.number().int().positive().max(100),
    freeOnly: z.coerce.boolean().optional().default(false),
});
export type AdminRandomQuestionsQuery = z.infer<typeof AdminRandomQuestionsQuerySchema>;

/** Preview-only question shape (correctIndex and explanation are excluded). */
export const AdminRandomQuestionSchema = z.object({
    _id: z.string(),
    examId: z.string(),
    text: z.string(),
    options: z.array(z.object({ index: z.number(), text: z.string() })).length(4),
    isFree: z.boolean(),
    tags: z.array(z.string()),
    order: z.number(),
});

export const AdminRandomQuestionsResponseSchema = z.object({
    data: z.array(AdminRandomQuestionSchema),
    count: z.number().int().nonnegative(),
});
export type AdminRandomQuestionsResponse = z.infer<typeof AdminRandomQuestionsResponseSchema>;
