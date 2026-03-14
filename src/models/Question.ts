import mongoose, { Schema } from "mongoose";

export interface IQuestionOption {
    index: number; // 0–3
    text: string;
}

export interface IQuestion {
    _id: mongoose.Types.ObjectId;
    examId: mongoose.Types.ObjectId;
    text: string;
    options: IQuestionOption[];
    correctIndex: number; // 0–3 (never exposed to client if gated)
    explanation?: string;
    isFree: boolean;
    tags: string[];
    order: number; // for consistent ordering
    createdAt: Date;
    updatedAt: Date;
}

const QuestionOptionSchema = new Schema<IQuestionOption>(
    {
        index: { type: Number, required: true, min: 0, max: 3 },
        text: { type: String, required: true },
    },
    { _id: false }
);

const QuestionSchema = new Schema<IQuestion>(
    {
        examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
        text: { type: String, required: true },
        options: {
            type: [QuestionOptionSchema],
            validate: {
                validator: (v: IQuestionOption[]) => v.length === 4,
                message: "A question must have exactly 4 options",
            },
        },
        correctIndex: { type: Number, required: true, min: 0, max: 3 },
        explanation: { type: String },
        isFree: { type: Boolean, default: false },
        tags: [{ type: String }],
        order: { type: Number, required: true, default: 0 },
    },
    { timestamps: true }
);

QuestionSchema.index({ examId: 1, order: 1 });

export const Question = mongoose.model<IQuestion>("Question", QuestionSchema);
