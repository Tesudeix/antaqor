import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Subsection from "@/models/Subsection";
import Section from "@/models/Section";

// GET — list subsections (?sectionId= or ?courseId=)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sectionId = searchParams.get("sectionId");
  const courseId = searchParams.get("courseId");
  await dbConnect();
  const q: Record<string, unknown> = {};
  if (sectionId) q.section = sectionId;
  else if (courseId) q.course = courseId;
  else return NextResponse.json({ subsections: [] });
  const subsections = await Subsection.find(q).sort({ order: 1 }).lean();
  return NextResponse.json({ subsections });
}

// POST — admin only
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { section, title, description, order } = await req.json();
  if (!section || !title?.trim()) {
    return NextResponse.json({ error: "section + title required" }, { status: 400 });
  }
  await dbConnect();
  const parent = await Section.findById(section).select("course").lean();
  if (!parent) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  const subsection = await Subsection.create({
    section,
    course: parent.course,
    title: title.trim(),
    description: description?.trim() || "",
    order: typeof order === "number" ? order : 0,
  });
  return NextResponse.json({ subsection }, { status: 201 });
}
