import { z } from "zod";

export const AdminRouteSchema = z.enum([
    "/courses",
    "/courses/:id",
    "/exams",
    "/exams/:id",
    "/exams/:id/random",
    "/questions",
    "/questions/bulk",
    "/questions/:id"
]);
export type AdminRoute = z.infer<typeof AdminRouteSchema>;
