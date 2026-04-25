import type { AddCourseBody, AddCourseResponse, GetCourseResponse, ListCoursesQuery, ListCoursesResponse, Course as CourseType, PatchCourseBody, UpdateCourseBody } from "@/schemas/index.js";
import { Course, type ICourse } from "@/models/course.js";
import { Exam } from "@/models/exam.js";
import { HttpError } from "@/utils/api-errors.js";
import type mongoose from "mongoose";
import { Question } from "@/models/question.js";

type CourseDocument = ICourse & { _id: mongoose.Types.ObjectId; __v: number };

export abstract class CourseController {
    /**
     * Formats a Mongoose Course document into the standard schema type.
     */
    private static formatCourse(course: CourseDocument): CourseType {
        return {
            _id: course._id.toString(),
            __v: course.__v,
            title: course.title,
            slug: course.slug,
            description: course.description,
            category: course.category,
            tags: course.tags,
            coverImage: course.coverImage,
            createdAt: course.createdAt.toISOString(),
            updatedAt: course.updatedAt.toISOString(),
        };
    }

    /**
     * Formats a complete course response by fetching and attaching all associated exams.
     */
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

    /**
     * Fetches a paginated list of courses. Can be optionally filtered by category.
     * Computes dynamically the associated exam counts for each course.
     */
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

        // Attach exams
        const courseIds = data.map((c) => c._id);
        const examsList = await Exam.find({ courseId: { $in: courseIds } })
            .select("_id courseId title")
            .lean();

        const courseExamsMap = new Map<string, { _id: string; title: string }[]>();

        examsList.forEach(e => {
            const courseIdStr = e.courseId.toString();
            if (!courseExamsMap.has(courseIdStr)) {
                courseExamsMap.set(courseIdStr, []);
            }
            courseExamsMap.get(courseIdStr)!.push({
                _id: e._id.toString(),
                title: e.title
            });
        });

        const coursesWithExams = data.map((c) => ({
            ...c,
            _id: c._id.toString(),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            exams: courseExamsMap.get(c._id.toString()) ?? [],
        }));

        return {
            data: coursesWithExams,
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

    /**
     * Fetches details of a single course by its unique slug.
     */
    public static getCourseBySlug = async (slug: string): Promise<GetCourseResponse> => {
        const course = await Course.findOne({ slug }).lean();
        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        return this.formatCourseResponse(course);
    }

    /**
     * Fetches details of a single course by its MongoDB ID.
     */
    public static getCourseById = async (courseId: string): Promise<GetCourseResponse> => {
        const course = await Course.findById(courseId).lean();
        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        return this.formatCourseResponse(course);
    }

    /**
     * Creates a new course from the provided payload.
     */
    public static addCourse = async (body: AddCourseBody): Promise<AddCourseResponse> => {
        const course = await Course.create(body);
        return this.formatCourse(course);
    }

    /**
     * Partially updates an existing course (PATCH semantics).
     */
    public static patchCourse = async ({ courseId, body }: { courseId: string; body: PatchCourseBody }): Promise<GetCourseResponse> => {
        const course = await Course.findByIdAndUpdate(courseId, body, {
            returnDocument: "after",
            runValidators: true,
        });

        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        return this.formatCourseResponse(course);
    }

    /**
     * Completely overwrites/replaces an existing course properties (PUT semantics).
     */
    public static updateCourse = async ({ courseId, body }: { courseId: string; body: UpdateCourseBody }): Promise<GetCourseResponse> => {
        const course = await Course.findById(courseId);

        if (!course) {
            throw new HttpError(404, "NOT_FOUND", "Course not found");
        }

        course.set(body);
        await course.save();

        return this.formatCourseResponse(course);
    }

    /**
     * Deletes a course. Safely cascades deletion down to all nested exams and their questions.
     */
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