import { Router } from "express";
import { z } from "zod";
import { authGuard, type AuthRequest } from "../middleware/authGuard";
import { Attempt } from "../models/Attempt";
import { Exam } from "../models/Exam";
import { Question } from "../models/Question";

export const attemptsRouter = Router();
attemptsRouter.use(authGuard);

// POST /api/attempts — start an attempt
attemptsRouter.post("/", async (req: AuthRequest, res, next) => {
    try {
        const { examId } = z.object({ examId: z.string() }).parse(req.body);

        const exam = await Exam.findById(examId);
        if (!exam) return res.status(404).json({ message: "Exam not found" });

        // Prevent multiple active attempts on the same exam
        const existing = await Attempt.findOne({
            userId: req.user!.userId,
            examId,
            status: "in_progress",
        });
        if (existing) {
            return res.json(existing); // Resume existing attempt
        }

        const questions = await Question.find({ examId }).sort({ order: 1 }).select("_id").lean();

        const attempt = new Attempt({
            userId: req.user!.userId,
            examId,
            answers: questions.map((q) => ({ questionId: q._id, selectedIndex: null })),
            totalMarks: exam.totalMarks,
        });
        await attempt.save();

        return res.status(201).json(attempt);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/attempts/:id/submit — submit answers and calculate score
attemptsRouter.patch("/:id/submit", async (req: AuthRequest, res, next) => {
    try {
        const AnswersSchema = z.object({
            answers: z.array(
                z.object({
                    questionId: z.string(),
                    selectedIndex: z.number().int().min(0).max(3).nullable(),
                })
            ),
        });
        const { answers } = AnswersSchema.parse(req.body);

        const attempt = await Attempt.findById(req.params["id"]);
        if (!attempt) return res.status(404).json({ message: "Attempt not found" });
        if (attempt.userId.toString() !== req.user!.userId) {
            return res.status(403).json({ message: "Not authorized" });
        }
        if (attempt.status !== "in_progress") {
            return res.status(400).json({ message: "Attempt already submitted" });
        }

        // Calculate score
        const questions = await Question.find({
            _id: { $in: answers.map((a) => a.questionId) },
        }).lean();
        const correctMap = new Map(questions.map((q) => [q._id.toString(), q.correctIndex]));

        let correct = 0;
        const processedAnswers = answers.map((a) => {
            const correctIndex = correctMap.get(a.questionId);
            if (a.selectedIndex !== null && a.selectedIndex === correctIndex) correct++;
            return { questionId: a.questionId, selectedIndex: a.selectedIndex };
        });

        const marksPerQuestion = attempt.totalMarks / answers.length;
        const score = Math.round(correct * marksPerQuestion * 100) / 100;

        attempt.answers = processedAnswers as unknown as typeof attempt.answers;
        attempt.score = score;
        attempt.status = "completed";
        attempt.submittedAt = new Date();
        await attempt.save();

        return res.json(attempt);
    } catch (err) {
        next(err);
    }
});

// GET /api/attempts/me — user's attempt history
attemptsRouter.get("/me", async (req: AuthRequest, res, next) => {
    try {
        const attempts = await Attempt.find({ userId: req.user!.userId })
            .populate("examId", "title courseId duration totalMarks")
            .sort({ createdAt: -1 })
            .lean();
        return res.json({ data: attempts });
    } catch (err) {
        next(err);
    }
});

// GET /api/attempts/:id
attemptsRouter.get("/:id", async (req: AuthRequest, res, next) => {
    try {
        const attempt = await Attempt.findById(req.params["id"])
            .populate("examId", "title duration totalMarks")
            .lean();
        if (!attempt) return res.status(404).json({ message: "Attempt not found" });
        if (attempt.userId.toString() !== req.user!.userId) {
            return res.status(403).json({ message: "Not authorized" });
        }
        return res.json(attempt);
    } catch (err) {
        next(err);
    }
});
