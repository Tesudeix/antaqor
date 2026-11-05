import { classroomContentGate } from "@/lib/classroomContentGate";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { sanitizeMaterials } from "@/lib/classroomMaterials";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";
import Course from "@/models/Course";
import Section from "@/models/Section";
import mongoose from "mongoose";
import LessonTask from "@/models/LessonTask";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await classroomContentGate();
  if (denied) return denied;
  try {
    const { id } = await params;
    await dbConnect();
    const lesson = await Lesson.findById(id).populate("course", "title").lean();
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }
    // Хуваарь: releaseAt ирээдүйд бол админаас бусдад агуулга өгөхгүй.
    const rel = (lesson as { releaseAt?: Date | null }).releaseAt;
    if (rel && new Date(rel).getTime() > Date.now()) {
      const session = await getServerSession(authOptions);
      if (!session?.user || !isAdmin(session.user.email)) {
        return NextResponse.json(
          { error: "Энэ хичээл хуваарийн дагуу дараа нээгдэнэ", locked: true, releaseAt: rel },
          { status: 423 }
        );
      }
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
    if (body.section) {
      const current = await Lesson.findById(id).select("course").lean();
      if (!current) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
      if (!mongoose.isValidObjectId(body.section) || !await Section.exists({ _id: body.section, course: current.course })) return NextResponse.json({ error: "Бүлэг энэ курст хамаарахгүй" }, { status: 400 });
    }
    const safeAttachments = sanitizeMaterials(body.attachments);

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
        ...(body.isPremium !== undefined && { isPremium: !!body.isPremium }),
        ...(body.durationSec !== undefined && { durationSec: Math.max(0, Number(body.durationSec) || 0) }),
        ...(body.releaseAt !== undefined && { releaseAt: body.releaseAt ? new Date(body.releaseAt) : null }),
        ...(body.section !== undefined && { section: body.section || null, subsection: null }),
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
      await LessonTask.deleteMany({ lesson: id });
      await Course.findByIdAndUpdate(lesson.course, { $inc: { lessonsCount: -1 } });
    }

    return NextResponse.json({ message: "Lesson deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
