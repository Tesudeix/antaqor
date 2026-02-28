import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Task from "@/models/Task";
import { awardXP } from "@/lib/xp";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const userId = (session.user as { id: string }).id;
    const admin = isAdmin(session.user.email);

    const task = await Task.findById(id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { action, submissionNote } = await req.json();

    // User claims an open task
    if (action === "claim") {
      if (task.status !== "open") {
        return NextResponse.json({ error: "Task is not open" }, { status: 400 });
      }
      task.assignedTo = userId as any;
      task.status = "submitted"; // auto-assign
      await task.save();
    }

    // User submits their work
    if (action === "submit") {
      if (task.assignedTo?.toString() !== userId) {
        return NextResponse.json({ error: "Not assigned to you" }, { status: 403 });
      }
      if (task.status !== "open" && task.status !== "rejected") {
        return NextResponse.json({ error: "Cannot submit in current status" }, { status: 400 });
      }
      task.status = "submitted";
      task.submissionNote = submissionNote?.trim() || "";
      await task.save();
    }

    // Admin accepts submission
    if (action === "accept") {
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (task.status !== "submitted") {
        return NextResponse.json({ error: "Task not submitted" }, { status: 400 });
      }
      task.status = "accepted";
      await task.save();

      // Award XP to the assigned user
      if (task.assignedTo) {
        await awardXP(
          task.assignedTo.toString(),
          "COMPLETE_TASK",
          task.xpReward,
          task._id.toString()
        );
      }
    }

    // Admin rejects submission
    if (action === "reject") {
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (task.status !== "submitted") {
        return NextResponse.json({ error: "Task not submitted" }, { status: 400 });
      }
      task.status = "rejected";
      await task.save();
    }

    const updated = await Task.findById(id)
      .populate("assignedTo", "name avatar")
      .populate("createdBy", "name")
      .lean();

    return NextResponse.json({ task: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await dbConnect();
    const { id } = await params;

    await Task.findByIdAndDelete(id);
    return NextResponse.json({ message: "Task deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
