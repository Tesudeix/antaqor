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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { course, section, subsection, title, description, content, videoUrl, videoType, thumbnail, order, requiredLevel, attachments, durationSec, releaseAt, isPremium } =
      await req.json();

    if (!course || !title?.trim()) {
      return NextResponse.json({ error: "Course and title are required" }, { status: 400 });
    }

    await dbConnect();

    if (!mongoose.isValidObjectId(course) || !await Course.exists({ _id: course })) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    if (section && (!mongoose.isValidObjectId(section) || !await Section.exists({ _id: section, course }))) return NextResponse.json({ error: "Бүлэг энэ курст хамаарахгүй" }, { status: 400 });
    const last = await Lesson.findOne({ course }).sort({ order: -1 }).select("order").lean();
    const safeAttachments = sanitizeMaterials(attachments) ?? [];

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
      order: typeof order === "number" && Number.isFinite(order) ? order : (last?.order || 0) + 1,
      isPremium: !!isPremium,
      requiredLevel: requiredLevel ?? 0,
      attachments: safeAttachments,
      durationSec: Math.max(0, Number(durationSec) || 0),
      releaseAt: releaseAt ? new Date(releaseAt) : null,
    });

    await Course.findByIdAndUpdate(course, { $inc: { lessonsCount: 1 } });

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
