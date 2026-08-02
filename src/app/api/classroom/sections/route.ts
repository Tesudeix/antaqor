import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Section from "@/models/Section";

// GET — list sections for a course (?courseId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  if (!courseId) return NextResponse.json({ sections: [] });
  await dbConnect();
  const sections = await Section.find({ course: courseId }).sort({ order: 1 }).lean();
  return NextResponse.json({ sections });
}

// POST — admin only
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { course, title, description, order } = await req.json();
  if (!course || !title?.trim()) {
    return NextResponse.json({ error: "course + title required" }, { status: 400 });
  }
  await dbConnect();
  const section = await Section.create({
    course,
    title: title.trim(),
    description: description?.trim() || "",
    order: typeof order === "number" ? order : 0,
  });
  return NextResponse.json({ section }, { status: 201 });
}
