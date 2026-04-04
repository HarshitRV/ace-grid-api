import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    passwordHash: string;
    role: "user" | "admin";
    purchasedExams: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true, minlength: 2 },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        purchasedExams: [{ type: Schema.Types.ObjectId, ref: "Exam" }],
    },
    { timestamps: true }
);

UserSchema.pre("save", async function () {
    if (!this.isModified("passwordHash")) return;
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

UserSchema.methods["comparePassword"] = function (candidate: string) {
    return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);
