import { Router } from "express";
import bcrypt from "bcryptjs";
import { RegisterInputSchema, LoginInputSchema } from "@/schemas/domain/auth.js";
import { User } from "@/models/user.js";
import { signToken } from "@/utils/jwt.js";
import { authGuard, type AuthRequest } from "@/middleware/auth-guard.js";
import { sendError } from "@/utils/api-errors.js";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", async (req, res, next) => {
    try {
        const body = RegisterInputSchema.parse(req.body);

        const existing = await User.findOne({ email: body.email });
        if (existing) {
            return sendError(
                res,
                409,
                "CONFLICT",
                "An account with this email already exists"
            );
        }

        const user = new User({
            name: body.name,
            email: body.email,
            passwordHash: body.password, // pre-save hook will hash this
        });
        await user.save();

        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return res.status(201).json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                purchasedExams: user.purchasedExams,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            accessToken: token,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/login
authRouter.post("/login", async (req, res, next) => {
    try {
        const body = LoginInputSchema.parse(req.body);

        const user = await User.findOne({ email: body.email });
        if (!user) {
            return sendError(res, 401, "UNAUTHENTICATED", "Invalid email or password");
        }

        const isValid = await bcrypt.compare(body.password, user.passwordHash);
        if (!isValid) {
            return sendError(res, 401, "UNAUTHENTICATED", "Invalid email or password");
        }

        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role,
        });

        return res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                purchasedExams: user.purchasedExams,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
            accessToken: token,
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
authRouter.get("/me", authGuard, async (req: AuthRequest, res, next) => {
    try {
        const user = await User.findById(req.user!.userId).select("-passwordHash");
        if (!user) return sendError(res, 404, "NOT_FOUND", "User not found");
        return res.json({ user });
    } catch (err) {
        next(err);
    }
});
