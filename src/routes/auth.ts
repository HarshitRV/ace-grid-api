import { Router } from "express";
import bcrypt from "bcryptjs";
import { RegisterInputSchema, LoginInputSchema } from "@/types/index.js";
import { User } from "@/models/User.js";
import { signToken, verifyToken } from "@/utils/jwt.js";

export const authRouter = Router();

// POST /api/auth/register
authRouter.post("/register", async (req, res, next) => {
    try {
        const body = RegisterInputSchema.parse(req.body);

        const existing = await User.findOne({ email: body.email });
        if (existing) {
            return res.status(409).json({ message: "An account with this email already exists" });
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
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const isValid = await bcrypt.compare(body.password, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ message: "Invalid email or password" });
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
authRouter.get("/me", async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authentication required" });
        }
        const payload = verifyToken(authHeader.split(" ")[1]!);
        const user = await User.findById(payload.userId).select("-passwordHash");
        if (!user) return res.status(404).json({ message: "User not found" });
        return res.json({ user });
    } catch (err) {
        next(err);
    }
});
