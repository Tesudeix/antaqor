import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import { CommentOrder } from "@/models/CommentOrder";
import MetaMessage from "@/models/MetaMessage";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "confirmed", "paid", "delivered"];

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const status = req.nextUrl.searchParams.get("status");
  const convId = req.nextUrl.searchParams.get("transcript");

  // Захиалгын харилцан ярианы transcript — drawer-т.
  if (convId) {
    const messages = await MetaMessage.find({ conversationId: convId })
      .sort({ createdAt: 1 })
      .limit(200)
      .select("direction text createdAt")
      .lean();
    return NextResponse.json({ messages });
  }

  const q: Record<string, unknown> = {};
  if (status && STATUSES.includes(status)) q.status = status;
  const orders = await CommentOrder.find(q).sort({ createdAt: -1 }).limit(200).lean();
  return NextResponse.json({ orders });
}

export async function PATCH(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: string; status?: string } | null;
  if (!b?.id || !STATUSES.includes(String(b.status)))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  await dbConnect();
  const order = await CommentOrder.findByIdAndUpdate(b.id, { $set: { status: b.status } }, { new: true }).lean();
  if (!order) return NextResponse.json({ error: "олдсонгүй" }, { status: 404 });
  return NextResponse.json({ order });
}
