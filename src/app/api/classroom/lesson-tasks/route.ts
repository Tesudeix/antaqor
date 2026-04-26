import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LessonTask from "@/models/LessonTask";
import Subsection from "@/models/Subsection";
import mongoose from "mongoose";

// GET — list tasks (?sectionId= or ?subsectionId= or ?courseId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get("sectionId");
  const subsectionId = searchParams.get("subsectionId");
  const courseId = searchParams.get("courseId");
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (sectionId) q.section = sectionId;
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
  const { section, subsection, title, description, deadline, maxScore, attachments } = await req.json();
  if ((!section && !subsection) || !title?.trim()) {
    return NextResponse.json({ error: "section + title required" }, { status: 400 });
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

  // Resolve course either via section or legacy subsection parent
  let courseId: mongoose.Types.ObjectId;
  if (section) {
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
