import { z } from "zod";

export const UserSchema = z.object({
    _id: z.string(),
    name: z.string().min(2),
    email: z.email(),
    role: z.enum(["user", "admin"]).default("user"),
    purchasedExams: z.array(z.string()).default([]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
