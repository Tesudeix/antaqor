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

    const { course, section, subsection, title, description, content, videoUrl, videoType, thumbnail, order, requiredLevel, attachments } =
      await req.json();

    if (!course || !title?.trim()) {
      return NextResponse.json({ error: "Course and title are required" }, { status: 400 });
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
          .slice(0, 10)
      : [];

    const lesson = await Lesson.create({
      course,
      section: section || undefined,
      subsection: subsection || undefined,
      title: title.trim(),
      description: description?.trim() || "",
      content: content?.trim() || "",
      videoUrl: videoUrl?.trim() || "",
      videoType: videoType || "link",
      thumbnail: thumbnail?.trim() || "",
      order: order ?? 0,
      requiredLevel: requiredLevel ?? 0,
      attachments: safeAttachments,
    });

    await Course.findByIdAndUpdate(course, { $inc: { lessonsCount: 1 } });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
