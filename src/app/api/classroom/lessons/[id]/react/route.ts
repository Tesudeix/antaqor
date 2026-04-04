import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Lesson from "@/models/Lesson";

const ALLOWED_EMOJIS = ["fire", "heart", "clap", "rocket", "think", "hundred", "haha"];

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
    const { emoji } = await req.json();

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const lesson = await Lesson.findById(id);
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    if (!lesson.reactions) {
      lesson.reactions = new Map();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawUsers: any[] = lesson.reactions.get(emoji) || [];
    const users: string[] = rawUsers.map((u) => String(u));
    const alreadyReacted = users.includes(userId);

    if (alreadyReacted) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lesson.reactions.set(emoji, users.filter((u) => u !== userId) as any);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lesson.reactions.set(emoji, [...users, userId] as any);
    }

    await lesson.save();

    // Build response with counts
    const reactionCounts: Record<string, { count: number; reacted: boolean }> = {};
    for (const key of ALLOWED_EMOJIS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawArr: any[] = lesson.reactions.get(key) || [];
      const arr: string[] = rawArr.map((u) => String(u));
      reactionCounts[key] = { count: arr.length, reacted: arr.includes(userId) };
    }

    return NextResponse.json({ reactions: reactionCounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to react";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
