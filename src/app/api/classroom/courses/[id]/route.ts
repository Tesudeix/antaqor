import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";
import Lesson from "@/models/Lesson";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const course = await Course.findById(id).lean();
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lessons = await Lesson.find({ course: id }).sort({ order: 1 }).lean();

    return NextResponse.json({ course, lessons });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch course";
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
    const { title, description, order } = await req.json();

    await dbConnect();
    const course = await Course.findByIdAndUpdate(
      id,
      {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(order !== undefined && { order }),
      },
      { new: true, runValidators: true }
    );

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update course";
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

    await Lesson.deleteMany({ course: id });
    await Course.findByIdAndDelete(id);

    return NextResponse.json({ message: "Course deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
