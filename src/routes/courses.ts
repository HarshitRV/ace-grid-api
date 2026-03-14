import { Router } from "express";
import { Course } from "@/models/Course.js";
import { Exam } from "@/models/Exam.js";

export const coursesRouter = Router();

// GET /api/courses
coursesRouter.get("/", async (req, res, next) => {
    try {
        const { category, page = "1", limit = "20" } = req.query as Record<string, string>;
        const filter: Record<string, unknown> = {};
        if (category) filter["category"] = category;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(50, parseInt(limit));
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
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/courses/:slug
coursesRouter.get("/:slug", async (req, res, next) => {
    try {
        const course = await Course.findOne({ slug: req.params["slug"] }).lean();
        if (!course) return res.status(404).json({ message: "Course not found" });

        const exams = await Exam.find({ courseId: course._id }).select("-questionIds").lean();

        return res.json({ ...course, exams });
    } catch (err) {
        next(err);
    }
});
