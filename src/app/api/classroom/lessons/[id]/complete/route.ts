import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const alreadyCompleted = lesson.completedBy.some(
      (uid: { toString: () => string }) => uid.toString() === userId
    );

    if (alreadyCompleted) {
      lesson.completedBy = lesson.completedBy.filter(
        (uid: { toString: () => string }) => uid.toString() !== userId
      );
    } else {
      lesson.completedBy.push(userId as any);
    }

    await lesson.save();

    return NextResponse.json({
      completed: !alreadyCompleted,
      completedCount: lesson.completedBy.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
