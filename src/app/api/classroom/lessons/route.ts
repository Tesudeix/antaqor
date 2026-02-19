import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";
import Course from "@/models/Course";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { course, title, description, content, videoUrl, videoType, thumbnail, order } =
      await req.json();

    if (!course || !title?.trim()) {
      return NextResponse.json({ error: "Course and title are required" }, { status: 400 });
    }

    await dbConnect();

    const lesson = await Lesson.create({
      course,
      title: title.trim(),
      description: description?.trim() || "",
      content: content?.trim() || "",
      videoUrl: videoUrl?.trim() || "",
      videoType: videoType || "link",
      thumbnail: thumbnail?.trim() || "",
      order: order ?? 0,
    });

    await Course.findByIdAndUpdate(course, { $inc: { lessonsCount: 1 } });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
