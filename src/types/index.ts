import { z } from "zod";

// ─── User ────────────────────────────────────────────────────────────────────

export const UserSchema = z.object({
    _id: z.string(),
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["user", "admin"]).default("user"),
    purchasedExams: z.array(z.string()).default([]),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const RegisterInputSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(16, "Password must be at most 16 characters"),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
    email: z.string().email(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(16, "Password must be at most 16 characters"),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthResponseSchema = z.object({
    user: UserSchema,
    accessToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ─── Course ───────────────────────────────────────────────────────────────────

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
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    category: CourseCategorySchema,
    tags: z.array(z.string()),
    examCount: z.number().int().nonnegative(),
    coverImage: z.string().url().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Course = z.infer<typeof CourseSchema>;

// ─── Exam ─────────────────────────────────────────────────────────────────────

export const ExamSchema = z.object({
    _id: z.string(),
    title: z.string(),
    courseId: z.string(),
    description: z.string().optional(),
    duration: z.number().int().positive().describe("Duration in minutes"),
    totalMarks: z.number().int().positive(),
    questionCount: z.number().int().nonnegative(),
    freeQuestionCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export type Exam = z.infer<typeof ExamSchema>;

// ─── Question ─────────────────────────────────────────────────────────────────

export const QuestionOptionSchema = z.object({
    index: z.number().int().min(0).max(3),
    text: z.string(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionSchema = z.object({
    _id: z.string(),
    examId: z.string(),
    text: z.string(),
    options: z.array(QuestionOptionSchema).length(4),
    /** null when gated (not purchased) */
    correctIndex: z.number().int().min(0).max(3).nullable(),
    /** null when gated */
    explanation: z.string().nullable(),
    isFree: z.boolean(),
    tags: z.array(z.string()),
    order: z.number().int().nonnegative(),
});
export type Question = z.infer<typeof QuestionSchema>;

// ─── Attempt ─────────────────────────────────────────────────────────────────

export const AnswerSchema = z.object({
    questionId: z.string(),
    selectedIndex: z.number().int().min(0).max(3).nullable(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const AttemptStatusSchema = z.enum(["in_progress", "completed", "expired"]);
export type AttemptStatus = z.infer<typeof AttemptStatusSchema>;

export const AttemptSchema = z.object({
    _id: z.string(),
    userId: z.string(),
    examId: z.string(),
    answers: z.array(AnswerSchema),
    score: z.number().nullable(),
    totalMarks: z.number(),
    status: AttemptStatusSchema,
    startedAt: z.string().datetime(),
    submittedAt: z.string().datetime().nullable(),
});
export type Attempt = z.infer<typeof AttemptSchema>;

export const SubmitAttemptInputSchema = z.object({
    answers: z.array(AnswerSchema),
});
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptInputSchema>;

// ─── API Responses ────────────────────────────────────────────────────────────

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
    });

export const ApiErrorSchema = z.object({
    message: z.string(),
    statusCode: z.number(),
    errors: z.array(z.string()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const envSchema = z.object({
    PORT: z.string().optional().default("3000"),
    MONGODB_URI: z.string().optional().default("mongodb://localhost:27017/prep-ui"),
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string(),
    FREE_QUESTIONS_COUNT: z.coerce.number().int().nonnegative(),
    CORS_ORIGIN: z.string().optional().default("*"),
    NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof envSchema>;

