import mongoose, { Schema } from "mongoose";

export interface IAnswer {
    questionId: mongoose.Types.ObjectId;
    selectedIndex: number | null;
}

export interface IAttempt {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    examId: mongoose.Types.ObjectId;
    answers: IAnswer[];
    score: number | null;
    totalMarks: number;
    status: "in_progress" | "completed" | "expired";
    startedAt: Date;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const AnswerSchema = new Schema<IAnswer>(
    {
        questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
        selectedIndex: { type: Number, default: null },
    },
    { _id: false }
);

const AttemptSchema = new Schema<IAttempt>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
        answers: [AnswerSchema],
        score: { type: Number, default: null },
        totalMarks: { type: Number, required: true },
        status: {
            type: String,
            enum: ["in_progress", "completed", "expired"],
            default: "in_progress",
        },
        startedAt: { type: Date, default: Date.now },
        submittedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

AttemptSchema.index({ userId: 1, examId: 1 });
AttemptSchema.index({ userId: 1, status: 1 });

export const Attempt = mongoose.model<IAttempt>("Attempt", AttemptSchema);
