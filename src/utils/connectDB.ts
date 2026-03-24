import mongoose from "mongoose";
import { appConfig } from "@/config/app-config.js";

export async function connectDB() {
    const uri = appConfig.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI environment variable is not set");

    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    mongoose.connection.on("error", (err) => {
        console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected");
    });
}
