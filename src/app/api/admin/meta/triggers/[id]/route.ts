import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaTrigger from "@/models/MetaTrigger";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  if (typeof b.name === "string") update.name = b.name.trim();
  if (typeof b.enabled === "boolean") update.enabled = b.enabled;
  if (typeof b.dmTemplate === "string") update.dmTemplate = b.dmTemplate.trim();
  if (typeof b.commentReply === "string") update.commentReply = b.commentReply.trim();
  if (typeof b.postId === "string") update.postId = b.postId.trim();
  if (Array.isArray(b.keywords)) update.keywords = b.keywords.filter((k): k is string => typeof k === "string").map((k) => k.trim()).filter(Boolean);
  if (["exact","contains","starts_with"].includes(b.matchMode as string)) update.matchMode = b.matchMode;
  if (["instagram","messenger","both"].includes(b.platform as string)) update.platform = b.platform;
  if (["comment","dm","both"].includes(b.surface as string)) update.surface = b.surface;
  await dbConnect();
  const trigger = await MetaTrigger.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!trigger) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ trigger });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await dbConnect();
  await MetaTrigger.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
