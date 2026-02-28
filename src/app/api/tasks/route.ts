import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Task from "@/models/Task";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const admin = isAdmin(session.user.email);

    let tasks;
    if (admin) {
      tasks = await Task.find()
        .sort({ createdAt: -1 })
        .populate("assignedTo", "name avatar")
        .populate("createdBy", "name")
        .lean();
    } else {
      tasks = await Task.find({
        $or: [{ status: "open" }, { assignedTo: userId }],
      })
        .sort({ createdAt: -1 })
        .populate("assignedTo", "name avatar")
        .populate("createdBy", "name")
        .lean();
    }

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { title, description, xpReward } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    const task = await Task.create({
      title: title.trim(),
      description: description?.trim() || "",
      xpReward: Math.max(200, Math.min(5000, Number(xpReward) || 200)),
      createdBy: userId,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
