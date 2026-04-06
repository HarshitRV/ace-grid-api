import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, type IUser } from "@/models/user.js";
import type { AuthResponse, LoginInput, RegisterInput, User as AuthUser, GetMeResponse } from "@/schemas/index.js";
import { HttpError } from "@/utils/api-errors.js";
import { signToken } from "@/utils/jwt.js";

type UserDocument = mongoose.Document<unknown, unknown, IUser> & IUser;

export abstract class AuthController {
    /**
     * Formats a Mongoose User document into the standard API response schema shape.
     */
    public static formatUser(user: UserDocument): AuthUser {
        return {
            _id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            purchasedExams: user.purchasedExams.map((exam) => exam.toString()),
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
        }
    }

    /**
     * Helper to consistently format the response containing both the user and their access token.
     */
    private static formatAuthResponse(user: UserDocument, token: string): AuthResponse {
        return {
            user: this.formatUser(user),
            accessToken: token,
        };
    }

    /**
     * Registers a new user account and returns an auth token.
     * Throws 409 Conflict if the email is already in use.
     */
    public static async register(body: RegisterInput): Promise<AuthResponse> {
        const existingUser = await User.findOne({ email: body.email });

        if (existingUser) {
            throw new HttpError(409, "CONFLICT", "An account with this email already exists");
        }

        const user = new User({
            name: body.name,
            email: body.email,
            passwordHash: body.password,
        });
        await user.save();

        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return this.formatAuthResponse(user, token);
    }

    /**
     * Authenticates an existing user via email and password, returning an auth token.
     * Throws 401 Unauthenticated for invalid credentials.
     */
    public static async login(body: LoginInput): Promise<AuthResponse> {
        const user = await User.findOne({ email: body.email });
        if (!user) {
            throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
        }

        const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
        if (!isValidPassword) {
            throw new HttpError(401, "UNAUTHENTICATED", "Invalid email or password");
        }

        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return this.formatAuthResponse(user, token);
    }

    /**
     * Fetches details of the currently authenticated user by their ID.
     */
    public static async getMe(userId: string): Promise<GetMeResponse> {
        const user = await User.findById(userId);
        if (!user) {
            throw new HttpError(404, "NOT_FOUND", "User not found");
        }
        return {
            user: this.formatUser(user)
        };
    }
}
