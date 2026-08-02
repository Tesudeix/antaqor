import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import ChatMessage from "@/models/ChatMessage";
import { isAdmin } from "@/lib/admin";
import { broadcastSSE } from "@/lib/sseHub";

export const dynamic = "force-dynamic";

// ─── LIVE room API — гишүүд л. Шинэ мессеж SSE-ээр (chat-message) цацагдана. ───

async function memberCtx() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { status: 401 as const };
  const userId = (session.user as { id: string }).id;
  await dbConnect();
  const u = await User.findById(userId).select("name avatar role email clan subscriptionExpiresAt").lean();
  if (!u) return { status: 401 as const };
  const now = new Date();
  const admin = (u as { role?: string }).role === "admin" || isAdmin((u as { email?: string }).email);
  const subActive = !!(
    (u as { subscriptionExpiresAt?: Date }).subscriptionExpiresAt &&
    new Date((u as { subscriptionExpiresAt?: Date }).subscriptionExpiresAt as Date) > now
  );
  if (!admin && !subActive) return { status: 402 as const };
  return {
    status: 200 as const,
    userId,
    name: (u as { name?: string }).name || "Гишүүн",
    avatar: (u as { avatar?: string }).avatar || "",
  };
}

export async function GET(req: NextRequest) {
  const ctx = await memberCtx();
  if (ctx.status !== 200) return NextResponse.json({ error: "gate" }, { status: ctx.status });

  const after = req.nextUrl.searchParams.get("after");
  const q: Record<string, unknown> = {};
  if (after) {
    const d = new Date(after);
    if (!isNaN(d.getTime())) q.createdAt = { $gt: d };
  }
  const rows = await ChatMessage.find(q).sort({ createdAt: -1 }).limit(60).lean();
  rows.reverse();
  return NextResponse.json({
    me: ctx.userId,
    serverNow: new Date().toISOString(),
    messages: rows.map((m) => ({
      id: String(m._id),
      userId: String(m.userId),
      name: m.name,
      avatar: m.avatar,
      text: m.text,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await memberCtx();
  if (ctx.status !== 200) return NextResponse.json({ error: "gate" }, { status: ctx.status });

  const b = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(b?.text || "").trim().slice(0, 500);
  if (text.length < 1) return NextResponse.json({ error: "empty" }, { status: 400 });

  const m = await ChatMessage.create({ userId: ctx.userId, name: ctx.name, avatar: ctx.avatar, text });
  const payload = {
    id: String(m._id),
    userId: ctx.userId,
    name: ctx.name,
    avatar: ctx.avatar,
    text,
    createdAt: m.createdAt,
  };
  // Realtime — бүх нээлттэй хэрэглэгч рүү SSE-ээр
  broadcastSSE("chat-message", payload);
  return NextResponse.json({ ok: true, message: payload });
}
