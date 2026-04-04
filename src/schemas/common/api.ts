import { z } from "zod";

export const PaginationSchema = z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().nonnegative(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        totalPages: z.number(),
        pagination: PaginationSchema,
    });

export const ApiErrorSchema = z.object({
    statusCode: z.number(),
    message: z.string(),
    error: z.object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
    }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
