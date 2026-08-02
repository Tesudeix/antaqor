import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LessonTask from "@/models/LessonTask";
import Lesson from "@/models/Lesson";
import Subsection from "@/models/Subsection";
import mongoose from "mongoose";

// GET — list tasks (?lessonId= or ?sectionId= or ?subsectionId= or ?courseId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  const sectionId = searchParams.get("sectionId");
  const subsectionId = searchParams.get("subsectionId");
  const courseId = searchParams.get("courseId");
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (lessonId) q.lesson = lessonId;
  else if (sectionId) q.section = sectionId;
  else if (subsectionId) q.subsection = subsectionId;
  else if (courseId) q.course = courseId;
  else return NextResponse.json({ tasks: [] });
  const tasks = await LessonTask.find(q).lean();
  return NextResponse.json({ tasks });
}

// POST — admin creates task on a section (or legacy subsection)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { lesson, section, subsection, title, description, deadline, maxScore, attachments } = await req.json();
  if ((!lesson && !section && !subsection) || !title?.trim()) {
    return NextResponse.json({ error: "lesson + title required" }, { status: 400 });
  }
  await dbConnect();

  const safeAttachments = Array.isArray(attachments)
    ? attachments
        .filter((a: { url?: string; name?: string }) => a?.url && a?.name)
        .map((a: { url: string; name: string; size?: number }) => ({
          url: String(a.url),
          name: String(a.name),
          size: typeof a.size === "number" ? a.size : undefined,
        }))
        .slice(0, 5)
    : [];

  // Resolve course via lesson (active), section, or legacy subsection
  let courseId: mongoose.Types.ObjectId;
  if (lesson) {
    const parent = await Lesson.findById(lesson).select("course").lean();
    if (!parent) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    courseId = parent.course as mongoose.Types.ObjectId;
    // Replace any prior task on the same lesson (one task per lesson)
    await LessonTask.deleteMany({ lesson });
  } else if (section) {
    const Section = (await import("@/models/Section")).default;
    const parent = await Section.findById(section).select("course").lean();
    if (!parent) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    courseId = parent.course as mongoose.Types.ObjectId;
  } else {
    const parent = await Subsection.findById(subsection).select("course").lean();
    if (!parent) return NextResponse.json({ error: "Subsection not found" }, { status: 404 });
    courseId = parent.course as mongoose.Types.ObjectId;
  }

  const task = await LessonTask.create({
    lesson: lesson || undefined,
    section: section || undefined,
    subsection: subsection || undefined,
    course: courseId,
    title: title.trim(),
    description: description?.trim() || "",
    attachments: safeAttachments,
    deadline: deadline ? new Date(deadline) : undefined,
    maxScore: typeof maxScore === "number" && maxScore > 0 ? maxScore : 10,
  });
  return NextResponse.json({ task }, { status: 201 });
}
