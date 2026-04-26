import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";
import Course from "@/models/Course";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const lesson = await Lesson.findById(id).populate("course", "title").lean();
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }
    return NextResponse.json({ lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    await dbConnect();
    const safeAttachments = Array.isArray(body.attachments)
      ? body.attachments
          .filter((a: { url?: string; name?: string }) => a?.url && a?.name)
          .map((a: { url: string; name: string; size?: number }) => ({
            url: String(a.url),
            name: String(a.name),
            size: typeof a.size === "number" ? a.size : undefined,
          }))
          .slice(0, 10)
      : undefined;

    const lesson = await Lesson.findByIdAndUpdate(
      id,
      {
        ...(body.title && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
        ...(body.videoType && { videoType: body.videoType }),
        ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
        ...(body.order !== undefined && { order: body.order }),
        ...(body.section !== undefined && { section: body.section || null }),
        ...(body.subsection !== undefined && { subsection: body.subsection || null }),
        ...(safeAttachments !== undefined && { attachments: safeAttachments }),
      },
      { new: true, runValidators: true }
    );

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({ lesson });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const lesson = await Lesson.findByIdAndDelete(id);
    if (lesson) {
      await Course.findByIdAndUpdate(lesson.course, { $inc: { lessonsCount: -1 } });
    }

    return NextResponse.json({ message: "Lesson deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
