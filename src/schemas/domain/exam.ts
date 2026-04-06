import { z } from "zod";
import { PaginatedResponseSchema } from "@/schemas/common/api.js";
import { QuestionSchema } from "@/schemas/domain/question.js";

export const ExamRouteSchema = z.enum([
    "/",
    "/:id",
]);
export type ExamRoute = z.infer<typeof ExamRouteSchema>;

export const ExamSchema = z.object({
    _id: z.string(),
    title: z.string(),
    courseId: z.string(),
    description: z.string().optional(),
    duration: z.number().int().positive().describe("Duration in minutes"),
    totalMarks: z.number().int().positive(),
    questionCount: z.number().int().nonnegative(),
    freeQuestionCount: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export type Exam = z.infer<typeof ExamSchema>;

export const ExamIdParamsSchema = z.object({
    id: z.string(),
});
export type ExamIdParams = z.infer<typeof ExamIdParamsSchema>;

export const ListExamsQuerySchema = z.object({
    courseId: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListExamsQuery = z.infer<typeof ListExamsQuerySchema>;

export const ListExamsResponseSchema = PaginatedResponseSchema(ExamSchema);
export type ListExamsResponse = z.infer<typeof ListExamsResponseSchema>;

/** Exam detail with gated questions. */
export const GetExamResponseSchema = z.object({
    exam: ExamSchema,
    questions: z.array(QuestionSchema),
});
export type GetExamResponse = z.infer<typeof GetExamResponseSchema>;
