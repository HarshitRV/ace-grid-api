import mongoose from "mongoose";
import { Course } from "@/models/course.js";
import { Exam } from "@/models/exam.js";
import { Question } from "@/models/question.js";
import { User } from "@/models/user.js";

import { appConfig } from "@/config/app-config.js";

const FREE_COUNT = appConfig.env.FREE_QUESTIONS_COUNT;

async function seed() {
    const uri = appConfig.env.MONGODB_URI;
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Promise.all([
        Course.deleteMany({}),
        Exam.deleteMany({}),
        Question.deleteMany({}),
        User.deleteMany({}),
    ]);

    // ── Create admin user ────────────────────────────────────────────────────────
    const admin = new User({
        name: "Admin",
        email: "admin@prep.dev",
        passwordHash: "Admin@123456",
        role: "admin",
    });
    await admin.save();

    // ── Courses ──────────────────────────────────────────────────────────────────
    const courses = await Course.insertMany([
        {
            title: "UPSC Civil Services Prelims",
            slug: "upsc-prelims",
            description:
                "Comprehensive MCQ practice for UPSC Preliminary Examination covering GS Paper I & CSAT.",
            category: "government",
            tags: ["UPSC", "GS Paper I", "CSAT", "Civil Services"],
        },
        {
            title: "JEE Main",
            slug: "jee-main",
            description:
                "Chapter-wise MCQ practice for Joint Entrance Examination (Main) — Physics, Chemistry, Maths.",
            category: "engineering",
            tags: ["JEE", "Physics", "Chemistry", "Mathematics"],
        },
        {
            title: "NEET UG",
            slug: "neet-ug",
            description:
                "NEET UG focused MCQ sets — Biology, Physics, Chemistry with detailed explanations.",
            category: "medical",
            tags: ["NEET", "Biology", "Physics", "Chemistry"],
        },
        {
            title: "CAT MBA Entrance",
            slug: "cat-mba",
            description: "Quantitative Aptitude, VARC, and DILR MCQ practice for CAT aspirants.",
            category: "management",
            tags: ["CAT", "QA", "VARC", "DILR"],
        },
    ]);

    // ── Exams & Questions for UPSC ───────────────────────────────────────────────
    const upscCourse = courses[0]!;
    const upscExam1 = await Exam.create({
        title: "UPSC GS Paper I — Polity Mock Test",
        courseId: upscCourse._id,
        description: "20 questions on Indian Polity and Constitution for UPSC Prelims practice.",
        duration: 30,
        totalMarks: 20,
        questionIds: [],
    });

    const upscQuestions = await Question.insertMany(
        Array.from({ length: 20 }, (_, i) => ({
            examId: upscExam1._id,
            text: `Indian Polity Question ${i + 1}: Which of the following statements about the [Topic ${i + 1}] is/are correct?`,
            options: [
                { index: 0, text: `Option A for question ${i + 1}` },
                { index: 1, text: `Option B for question ${i + 1}` },
                { index: 2, text: `Option C for question ${i + 1}` },
                { index: 3, text: `Option D for question ${i + 1}` },
            ],
            correctIndex: i % 4,
            explanation: `Explanation for question ${i + 1}: The correct answer is option ${["A", "B", "C", "D"][i % 4]} because...`,
            isFree: i < FREE_COUNT,
            tags: ["polity", "constitution"],
            order: i,
        }))
    );

    await Exam.findByIdAndUpdate(upscExam1._id, {
        questionIds: upscQuestions.map((q) => q._id),
    });

    // ── Exam for JEE ─────────────────────────────────────────────────────────────
    const jeeCourse = courses[1]!;
    const jeeExam1 = await Exam.create({
        title: "JEE Main — Physics Chapter Test: Kinematics",
        courseId: jeeCourse._id,
        description: "15 MCQs covering kinematics, equations of motion, and projectile motion.",
        duration: 25,
        totalMarks: 15,
        questionIds: [],
    });

    const jeeQuestions = await Question.insertMany(
        Array.from({ length: 15 }, (_, i) => ({
            examId: jeeExam1._id,
            text: `Physics Question ${i + 1}: A particle starts from rest. Which expression correctly relates [Quantity ${i + 1}]?`,
            options: [
                { index: 0, text: `v = u + at where a = ${i + 1} m/s²` },
                { index: 1, text: `s = ut + ½at² where t = ${i + 1}s` },
                { index: 2, text: `v² = u² + 2as where s = ${i * 2}m` },
                { index: 3, text: `None of the above` },
            ],
            correctIndex: i % 3,
            explanation: `For kinematics question ${i + 1}: Using the equation of motion...`,
            isFree: i < FREE_COUNT,
            tags: ["kinematics", "mechanics"],
            order: i,
        }))
    );

    await Exam.findByIdAndUpdate(jeeExam1._id, {
        questionIds: jeeQuestions.map((q) => q._id),
    });

    console.log("🌱 Database seeded successfully!");
    console.log(`   Courses: ${courses.length}`);
    console.log(`   UPSC Exam: ${upscQuestions.length} questions (${FREE_COUNT} free)`);
    console.log(`   JEE Exam: ${jeeQuestions.length} questions (${FREE_COUNT} free)`);
    console.log(`   Admin: admin@prep.dev / Admin@123456`);

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
});
