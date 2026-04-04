import { z } from "zod";
import { PaginatedResponseSchema } from "@/schemas/common/api.js";

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
