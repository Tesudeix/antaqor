import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LessonTask from "@/models/LessonTask";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await dbConnect();
  const task = await LessonTask.findById(id).lean();
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await dbConnect();
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (typeof body.maxScore === "number") update.maxScore = body.maxScore;
  if (body.deadline !== undefined) update.deadline = body.deadline ? new Date(body.deadline) : null;
  if (Array.isArray(body.attachments)) {
    update.attachments = body.attachments
      .filter((a: { url?: string; name?: string }) => a?.url && a?.name)
      .map((a: { url: string; name: string; size?: number }) => ({
        url: String(a.url),
        name: String(a.name),
        size: typeof a.size === "number" ? a.size : undefined,
      }))
      .slice(0, 5);
  }
  const task = await LessonTask.findByIdAndUpdate(id, update, { new: true });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await dbConnect();
  await LessonTask.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
