import { Router } from "express";
import { CourseRoute, GetCourseBySlugParamsSchema, ListCoursesQuerySchema } from "@/schemas/index.js";
import { handleAsyncError } from "@/utils/handler-async-error.js";
import { CourseController } from "@/controllers/course.controller.js";

export const coursesRouter = Router();

// GET v1/api/courses
coursesRouter.route<CourseRoute>('/').get(handleAsyncError(async (req, res, _next) => {
    const { category, page, limit } = ListCoursesQuerySchema.parse(req.query);
    const response = await CourseController.listCourses({ category, page, limit });
    res.status(200).json(response);
}));

// GET v1/api/courses/:slug
coursesRouter.route<CourseRoute>('/:slug').get(handleAsyncError(async (req, res, _next) => {
    const { slug } = GetCourseBySlugParamsSchema.parse(req.params);
    const response = await CourseController.getCourseBySlug(slug);
    res.status(200).json(response);
}));

