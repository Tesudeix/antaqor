import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Section from "@/models/Section";
import Subsection from "@/models/Subsection";
import Lesson from "@/models/Lesson";
import LessonTask from "@/models/LessonTask";

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
  // Cascade: delete subsections, their lessons (subsection ref) and tasks
  const subs = await Subsection.find({ section: id }).select("_id").lean();
  const subIds = subs.map((s) => s._id);
  if (subIds.length) {
    await Lesson.deleteMany({ subsection: { $in: subIds } });
    await LessonTask.deleteMany({ subsection: { $in: subIds } });
    await Subsection.deleteMany({ _id: { $in: subIds } });
  }
  await Section.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
