import mongoose, { Schema } from "mongoose";

export interface IExam {
    _id: mongoose.Types.ObjectId;
    title: string;
    courseId: mongoose.Types.ObjectId;
    description?: string;
    duration: number; // minutes
    totalMarks: number;
    questionIds: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
    {
        title: { type: String, required: true, trim: true },
        courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
        description: { type: String },
        duration: { type: Number, required: true, min: 1 }, // minutes
        totalMarks: { type: Number, required: true, min: 1 },
        questionIds: [{ type: Schema.Types.ObjectId, ref: "Question" }],
    },
    { timestamps: true }
);

ExamSchema.index({ courseId: 1 });

export const Exam = mongoose.model<IExam>("Exam", ExamSchema);
