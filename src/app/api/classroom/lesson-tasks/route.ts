import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LessonTask from "@/models/LessonTask";
import Subsection from "@/models/Subsection";

// GET — list tasks (?subsectionId= or ?courseId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subsectionId = searchParams.get("subsectionId");
  const courseId = searchParams.get("courseId");
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (subsectionId) q.subsection = subsectionId;
  else if (courseId) q.course = courseId;
  else return NextResponse.json({ tasks: [] });
  const tasks = await LessonTask.find(q).lean();
  return NextResponse.json({ tasks });
}

// POST — admin creates task on subsection
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { subsection, title, description, deadline, maxScore } = await req.json();
  if (!subsection || !title?.trim()) {
    return NextResponse.json({ error: "subsection + title required" }, { status: 400 });
  }
  await dbConnect();
  const parent = await Subsection.findById(subsection).select("course").lean();
  if (!parent) return NextResponse.json({ error: "Subsection not found" }, { status: 404 });
  const task = await LessonTask.create({
    subsection,
    course: parent.course,
    title: title.trim(),
    description: description?.trim() || "",
    deadline: deadline ? new Date(deadline) : undefined,
    maxScore: typeof maxScore === "number" && maxScore > 0 ? maxScore : 10,
  });
  return NextResponse.json({ task }, { status: 201 });
}
