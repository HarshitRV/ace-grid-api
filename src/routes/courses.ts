import { Router } from "express";
import { z } from "zod";
import { Course } from "@/models/Course.js";
import { Exam } from "@/models/Exam.js";
import { sendError } from "@/utils/apiErrors.js";

export const coursesRouter = Router();

const ListCoursesQuerySchema = z.object({
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

// GET /api/courses
coursesRouter.get("/", async (req, res, next) => {
    try {
        const { category, page, limit } = ListCoursesQuerySchema.parse(req.query);
        const filter: Record<string, unknown> = {};
        if (category) filter["category"] = category;

        const pageNum = page;
        const limitNum = limit;
        const skip = (pageNum - 1) * limitNum;

        const [data, total] = await Promise.all([
            Course.find(filter).skip(skip).limit(limitNum).lean(),
            Course.countDocuments(filter),
        ]);

        // Attach exam count
        const courseIds = data.map((c) => c._id);
        const examCounts = await Exam.aggregate([
            { $match: { courseId: { $in: courseIds } } },
            { $group: { _id: "$courseId", count: { $sum: 1 } } },
        ]);
        const examCountMap = new Map(
            examCounts.map((e: { _id: string; count: number }) => [e._id.toString(), e.count])
        );

        const coursesWithCount = data.map((c) => ({
            ...c,
            examCount: examCountMap.get(c._id.toString()) ?? 0,
        }));

        return res.json({
            data: coursesWithCount,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
            pagination: {
                page: pageNum,
                pageSize: limitNum,
                totalItems: total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/courses/:slug
coursesRouter.get("/:slug", async (req, res, next) => {
    try {
        const course = await Course.findOne({ slug: req.params["slug"] }).lean();
        if (!course) return sendError(res, 404, "NOT_FOUND", "Course not found");

        const exams = await Exam.find({ courseId: course._id }).select("-questionIds").lean();

        return res.json({ ...course, exams });
    } catch (err) {
        next(err);
    }
});

