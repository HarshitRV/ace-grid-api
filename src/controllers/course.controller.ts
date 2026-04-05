import type { GetCourseBySlugResponse, ListCoursesQuery, ListCoursesResponse } from "@/schemas/index.js";
import { Course } from "@/models/course.js";
import { Exam } from "@/models/exam.js";
import { HttpError } from "@/utils/api-errors.js";

export abstract class CourseController {
    public static listCourses = async ({ category, page, limit }: ListCoursesQuery): Promise<ListCoursesResponse> => {
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
            _id: c._id.toString(),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            examCount: examCountMap.get(c._id.toString()) ?? 0,
        }));

        return {
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
        }
    }

    public static getCourseBySlug = async (slug: string): Promise<GetCourseBySlugResponse> => {
        const course = await Course.findOne({ slug }).lean();
        if (!course) throw new HttpError(404, "NOT_FOUND", "Course not found");

        const exams = await Exam.find({ courseId: course._id }).select("-questionIds").lean();

        return {
            course: {
                ...course,
                _id: course._id.toString(),
                createdAt: course.createdAt.toISOString(),
                updatedAt: course.updatedAt.toISOString(),
            },
            exams: exams.map((exam) => ({
                ...exam,
                _id: exam._id.toString(),
                courseId: exam.courseId.toString(),
                createdAt: exam.createdAt.toISOString(),
                updatedAt: exam.updatedAt.toISOString(),
            })),
        }
    }
}