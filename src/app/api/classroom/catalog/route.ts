import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Lesson from "@/models/Lesson";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await dbConnect();
    const [courses, lessons] = await Promise.all([
      Course.find().sort({ order: 1 }).select("title description coverImage thumbnail comingSoon outcome").lean(),
      Lesson.find().sort({ order: 1 }).select("course title durationSec releaseAt").lean(),
    ]);
    return NextResponse.json({ courses: courses.map(c => ({ ...c, lessons: lessons.filter(l => String(l.course) === String(c._id)).map(l => ({ id: String(l._id), title: l.title, durationSec: l.durationSec, locked: true })) })) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  } catch { return NextResponse.json({ error: "Сургалтыг ачаалж чадсангүй" }, { status: 503 }); }
}
