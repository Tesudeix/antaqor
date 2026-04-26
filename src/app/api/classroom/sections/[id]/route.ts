import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Section from "@/models/Section";
import Subsection from "@/models/Subsection";
import Lesson from "@/models/Lesson";
import LessonTask from "@/models/LessonTask";
import Course from "@/models/Course";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await dbConnect();
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (typeof body.order === "number") update.order = body.order;
  const section = await Section.findByIdAndUpdate(id, update, { new: true });
  if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ section });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await dbConnect();

  const sec = await Section.findById(id).select("course").lean();
  if (!sec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Lessons tied directly to the section (active 2-level)
  const directLessons = await Lesson.find({ section: id }).select("_id").lean();
  const directLessonIds = directLessons.map((l) => l._id);
  let lessonsRemoved = directLessons.length;

  // Legacy: subsections under this section + their lessons/tasks
  const subs = await Subsection.find({ section: id }).select("_id").lean();
  const subIds = subs.map((s) => s._id);
  if (subIds.length) {
    const legacyLessons = await Lesson.find({ subsection: { $in: subIds } }).select("_id").lean();
    const legacyLessonIds = legacyLessons.map((l) => l._id);
    lessonsRemoved += legacyLessons.length;
    if (legacyLessonIds.length) {
      await LessonTask.deleteMany({ lesson: { $in: legacyLessonIds } });
    }
    await Lesson.deleteMany({ subsection: { $in: subIds } });
    await LessonTask.deleteMany({ subsection: { $in: subIds } });
    await Subsection.deleteMany({ _id: { $in: subIds } });
  }

  if (directLessonIds.length) {
    await LessonTask.deleteMany({ lesson: { $in: directLessonIds } });
  }
  await Lesson.deleteMany({ section: id });
  await LessonTask.deleteMany({ section: id });
  await Section.findByIdAndDelete(id);

  if (lessonsRemoved > 0) {
    await Course.findByIdAndUpdate(sec.course, { $inc: { lessonsCount: -lessonsRemoved } });
  }

  return NextResponse.json({ success: true });
}
