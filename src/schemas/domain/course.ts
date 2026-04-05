import { z } from "zod";
import { PaginatedResponseSchema } from "@/schemas/common/api.js";
import { ExamSchema } from "@/schemas/domain/exam.js";

export const CourseRouteSchema = z.enum([
    "/",
    "/:slug",
]);
export type CourseRoute = z.infer<typeof CourseRouteSchema>;

export const CourseCategorySchema = z.enum([
    "government",
    "engineering",
    "medical",
    "management",
    "banking",
    "language",
    "other",
]);
export type CourseCategory = z.infer<typeof CourseCategorySchema>;

export const CourseSchema = z.object({
    _id: z.string(),
    __v: z.number(),
    title: z.string(),
    slug: z.string(),
    description: z.string().optional(),
    category: CourseCategorySchema,
    tags: z.array(z.string()),
    examCount: z.number().int().nonnegative(),
    coverImage: z.url().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CoursesResponseSchema = PaginatedResponseSchema(CourseSchema);
export type CoursesResponse = z.infer<typeof CoursesResponseSchema>;

export const ListCoursesQuerySchema = z.object({
    category: z
        .enum([
            "government",
            "engineering",
            "medical",
            "management",
            "banking",
            "language",
            "other",
        ])
        .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListCoursesQuery = z.infer<typeof ListCoursesQuerySchema>;

export const ListCoursesResponseSchema = z.object({
    data: z.array(CourseSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    limit: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    pagination: z.object({
        page: z.number().int().nonnegative(),
        pageSize: z.number().int().nonnegative(),
        totalItems: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
    }),
});
export type ListCoursesResponse = z.infer<typeof ListCoursesResponseSchema>;

export const GetCourseBySlugParamsSchema = z.object({
    slug: z.string(),
});
export type GetCourseBySlugParams = z.infer<typeof GetCourseBySlugParamsSchema>;

export const GetCourseBySlugResponseSchema = z.object({
    course: CourseSchema.omit({ examCount: true }),
    exams: z.array(ExamSchema.omit({ questionCount: true, freeQuestionCount: true })),
});
export type GetCourseBySlugResponse = z.infer<typeof GetCourseBySlugResponseSchema>;