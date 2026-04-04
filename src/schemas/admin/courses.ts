import { z } from "zod";
import { CourseCategorySchema } from "@/schemas/domain/course.js";

const CourseDescriptionSchema = z.union([
    z.string().min(10, "Description must be at least 10 characters").max(50, "Description cannot exceed 50 characters"),
    z.literal(""),
]);

const CourseTagSchema = z
    .string()
    .min(2, "Tag must be at least 2 characters")
    .max(30, "Tag cannot exceed 30 characters");

const CourseCoverImageSchema = z.union([z.url("Invalid URL"), z.literal("")]);

export const AdminCourseBodySchema = z.object({
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

export const AdminCoursePutBodySchema = z.object({
    title: z.string().min(2).max(50),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/).max(50),
    description: CourseDescriptionSchema,
    category: CourseCategorySchema,
    tags: z.array(CourseTagSchema),
    coverImage: CourseCoverImageSchema,
});

export const AdminCoursePatchBodySchema = AdminCourseBodySchema.partial();
