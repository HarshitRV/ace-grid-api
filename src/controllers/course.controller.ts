import type { AddCourseBody, AddCourseResponse, GetCourseResponse, ListCoursesQuery, ListCoursesResponse, Course as CourseType, PatchCourseBody, UpdateCourseBody } from "@/schemas/index.js";
import { Course, type ICourse } from "@/models/course.js";
import { Exam } from "@/models/exam.js";
import { HttpError } from "@/utils/api-errors.js";
import type mongoose from "mongoose";
import { Question } from "@/models/question.js";

type CourseDocument = ICourse & { _id: mongoose.Types.ObjectId; __v: number };

export abstract class CourseController {
    private static formatCourse(course: CourseDocument): CourseType {
        return {
            ...course,
            _id: course._id.toString(),
            createdAt: course.createdAt.toISOString(),
            updatedAt: course.updatedAt.toISOString(),
        }
    }

    private static formatCourseResponse = async (course: CourseDocument): Promise<GetCourseResponse> => {
        const exams = await Exam.find({ courseId: course._id }).select("-questionIds").lean();

        return {
            course: this.formatCourse(course),
            exams: exams.map((exam) => ({
                ...exam,
                _id: exam._id.toString(),
                courseId: exam.courseId.toString(),
                createdAt: exam.createdAt.toISOString(),
                updatedAt: exam.updatedAt.toISOString(),
            })),
        }
    }

    public static getCourseList = async ({ category, page, limit }: ListCoursesQuery): Promise<ListCoursesResponse> => {
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

    public static getCourseBySlug = async (slug: string): Promise<GetCourseResponse> => {
        const course = await Course.findOne({ slug }).lean();
        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        return this.formatCourseResponse(course);
    }

    public static getCourseById = async (courseId: string): Promise<GetCourseResponse> => {
        const course = await Course.findById(courseId).lean();
        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        return this.formatCourseResponse(course);
    }

    public static addCourse = async (body: AddCourseBody): Promise<AddCourseResponse> => {
        const course = await Course.create(body)
        return this.formatCourse(course);
    }

    public static patchCourse = async ({ courseId, body }: { courseId: string; body: PatchCourseBody }): Promise<GetCourseResponse> => {
        const course = await Course.findByIdAndUpdate(courseId, body, {
            returnDocument: "after",
            runValidators: true,
        });

        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        };

        return this.formatCourseResponse(course);
    }

    public static updateCourse = async ({ courseId, body }: { courseId: string; body: UpdateCourseBody }): Promise<GetCourseResponse> => {
        const course = await Course.findById(courseId);

        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        course.set(body);
        await course.save();

        return this.formatCourseResponse(course);
    }

    public static deleteCourseWithRelatedEntities = async (courseId: string): Promise<void> => {
        const course = await Course.findById(courseId);
        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        const exams = await Exam.find({ courseId: course._id }).select("_id").lean();
        const examIds = exams.map((e) => e._id);

        await Question.deleteMany({ examId: { $in: examIds } });
        await Exam.deleteMany({ courseId: course._id });
        await course.deleteOne();
    }
}