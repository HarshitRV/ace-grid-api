import mongoose, { Schema } from "mongoose";

export interface ICourse {
    _id: mongoose.Types.ObjectId;
    title: string;
    slug: string;
    description?: string;
    category:
        | "government"
        | "engineering"
        | "medical"
        | "management"
        | "banking"
        | "language"
        | "other";
    tags: string[];
    coverImage?: string;
    createdAt: Date;
    updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String },
        category: {
            type: String,
            enum: [
                "government",
                "engineering",
                "medical",
                "management",
                "banking",
                "language",
                "other",
            ],
            required: true,
        },
        tags: [{ type: String }],
        coverImage: { type: String },
    },
    { timestamps: true }
);

CourseSchema.index({ category: 1 });

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
