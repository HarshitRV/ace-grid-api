import { z } from "zod";
import { CourseSchema, GetCourseResponseSchema } from "@/schemas/domain/course.js";

export const AdminCreateCourseResponseSchema = CourseSchema;
export type AdminCreateCourseResponse = z.infer<typeof AdminCreateCourseResponseSchema>;

export const AdminUpdateCourseResponseSchema = GetCourseResponseSchema;
export type AdminUpdateCourseResponse = z.infer<typeof AdminUpdateCourseResponseSchema>;

export const AdminDeleteCourseResponseSchema = z.object({
    message: z.string(),
});
export type AdminDeleteCourseResponse = z.infer<typeof AdminDeleteCourseResponseSchema>;
