import { z } from "zod";
import { PaginatedResponseSchema } from "@/schemas/common/api.js";
import { ExamSchema } from "@/schemas/domain/exam.js";

export const CourseRouteSchema = z.enum([
    "/",
    "/:slug",
]);
export type CourseRoute = z.infer<typeof CourseRouteSchema>;

export const CourseDescriptionSchema = z.union([
    z.string().min(10, "Description must be at least 10 characters").max(50, "Description cannot exceed 50 characters"),
    z.literal(""),
]);

export const CourseTagSchema = z
    .string()
    .min(2, "Tag must be at least 2 characters")
    .max(30, "Tag cannot exceed 30 characters");

export const CourseCoverImageSchema = z.union([z.url("Invalid URL"), z.literal("")]);

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
    description: CourseDescriptionSchema.optional(),
    category: CourseCategorySchema,
    tags: z.array(CourseTagSchema).optional(),
    exams: z.array(z.object({ _id: z.string(), title: z.string() })).optional(),
    coverImage: CourseCoverImageSchema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});
export type Course = z.infer<typeof CourseSchema>;

export const CourseBodySchema = z.object({
    title: z
        .string()
        .min(2, "Title must be at least 2 characters")
        .max(50, "Title cannot exceed 50 characters"),
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .regex(/^[a-z0-9-]+$/, "Slug must be lowercase and contain no spaces (use hyphens instead)")
        .max(50, "Slug cannot exceed 50 characters"),
    description: CourseDescriptionSchema.optional(),
    category: CourseCategorySchema,
    tags: z.array(CourseTagSchema).optional(),
    coverImage: CourseCoverImageSchema.optional(),
});
export type AddCourseBody = z.infer<typeof CourseBodySchema>;
export type AddCourseResponse = z.infer<typeof CourseSchema>;
export type UpdateCourseBody = z.infer<typeof CourseBodySchema>;

export const PatchCourseBodySchema = CourseBodySchema.partial();
export type PatchCourseBody = z.infer<typeof PatchCourseBodySchema>;

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

export const GetCourseByIdParamsSchema = z.object({
    id: z.string(),
});
export type GetCourseByIdParams = z.infer<typeof GetCourseByIdParamsSchema>;

export const GetCourseResponseSchema = z.object({
    course: CourseSchema.omit({ exams: true }),
    exams: z.array(ExamSchema.omit({ questionCount: true, freeQuestionCount: true })),
});
export type GetCourseResponse = z.infer<typeof GetCourseResponseSchema>;
