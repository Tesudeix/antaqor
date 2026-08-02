import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Lesson from "@/models/Lesson";
import { broadcastNotification } from "@/lib/notifications";

export async function GET() {
  try {
    await dbConnect();
    const courses = await Course.find().sort({ order: 1 }).lean();
    const agg = await Lesson.aggregate([
      { $group: { _id: "$course", total: { $sum: { $ifNull: ["$durationSec", 0] } } } },
    ]);
    const durByCourse = new Map<string, number>(
      agg.map((a: { _id: unknown; total: number }) => [String(a._id), a.total])
    );
    const withTime = courses.map((c) => ({
      ...c,
      totalDurationSec: durByCourse.get(String(c._id)) || 0,
    }));
    return NextResponse.json({ courses: withTime });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch courses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { title, description, thumbnail, coverImage, order, requiredLevel, category } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await dbConnect();
    const course = await Course.create({
      title: title.trim(),
      description: description?.trim() || "",
      thumbnail: thumbnail || "",
      coverImage: coverImage || "",
      order: order ?? 0,
      requiredLevel: requiredLevel ?? 0,
      category: typeof category === "string" ? category.trim() : "",
    });

    broadcastNotification({
      type: "new_course",
      title: "New Course",
      message: `New course available: ${title.trim()}`,
      link: "/classroom",
    }).catch(() => {});

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
