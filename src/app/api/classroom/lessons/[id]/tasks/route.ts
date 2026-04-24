import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }

    const { id } = await params;
    const { taskIndex, action } = await req.json();
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const task = lesson.lessonTasks[taskIndex];
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (action === "claim") {
      if (task.assignedTo) {
        return NextResponse.json({ error: "Task already claimed" }, { status: 400 });
      }
      lesson.lessonTasks[taskIndex].assignedTo = userId as unknown as typeof task.assignedTo;
    } else if (action === "unclaim") {
      if (String(task.assignedTo) !== userId) {
        return NextResponse.json({ error: "Not your task" }, { status: 403 });
      }
      lesson.lessonTasks[taskIndex].assignedTo = undefined;
      lesson.lessonTasks[taskIndex].completed = false;
    } else if (action === "complete") {
      if (String(task.assignedTo) !== userId) {
        return NextResponse.json({ error: "Not your task" }, { status: 403 });
      }
      lesson.lessonTasks[taskIndex].completed = !task.completed;
    }

    await lesson.save();
    const updated = await Lesson.findById(id)
      .populate("lessonTasks.assignedTo", "name avatar")
      .lean();

    return NextResponse.json({ lessonTasks: updated?.lessonTasks || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
