import { z } from "zod";
import { UserSchema } from "@/schemas/domain/user.js";

export const AuthRouteSchema = z.enum([
    "/register",
    "/login",
    "/me"
]);
export type AuthRoute = z.infer<typeof AuthRouteSchema>;

export const AuthCredentialsSchema = z.object({
    email: z.email("Invalid email address"),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(64, "Password must be at most 64 characters"),
});
export type AuthCredentials = z.infer<typeof AuthCredentialsSchema>;

export const RegisterInputSchema = AuthCredentialsSchema.extend({
    name: z.string().min(2, "Name must be at least 2 characters"),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = AuthCredentialsSchema;
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const AuthResponseSchema = z.object({
    user: UserSchema,
    accessToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const GetMeResponseSchema = z.object({
    user: UserSchema,
});
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;