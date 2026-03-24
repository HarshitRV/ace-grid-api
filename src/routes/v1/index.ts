/**
 * v1 route bundle.
 *
 * Re-exports the current route handlers as the "v1" API surface.
 * When you create v2, copy this file to `routes/v2/index.ts` and
 * swap in the new routers — the originals stay untouched.
 */
export { authRouter } from "@/routes/auth.js";
export { coursesRouter } from "@/routes/courses.js";
export { examsRouter } from "@/routes/exams.js";
export { attemptsRouter } from "@/routes/attempts.js";
export { adminRouter } from "@/routes/admin.js";
