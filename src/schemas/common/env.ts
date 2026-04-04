import { z } from "zod";

export const envSchema = z.object({
    PORT: z.string().optional().default("3000"),
    MONGODB_URI: z.string().optional().default("mongodb://localhost:27017/ace-grid"),
    JWT_SECRET: z.string(),
    JWT_EXPIRES_IN: z.string(),
    FREE_QUESTIONS_COUNT: z.coerce.number().int().nonnegative(),
    CORS_ORIGIN: z.string().optional().default("*"),
    NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
});

export type Env = z.infer<typeof envSchema>;
