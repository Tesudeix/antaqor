import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaFlow from "@/models/MetaFlow";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof b.name === "string") update.name = b.name.trim();
  if (typeof b.enabled === "boolean") update.enabled = b.enabled;
  if (["instagram", "messenger", "both"].includes(b.platform)) update.platform = b.platform;
  if (["any", "contains", "exact", "starts_with"].includes(b.matchMode)) update.matchMode = b.matchMode;
  if (Array.isArray(b.triggerKeywords)) update.triggerKeywords = b.triggerKeywords;
  if (typeof b.entryCardId === "string") update.entryCardId = b.entryCardId;
  if (typeof b.account === "string") update.account = b.account;
  if (typeof b.imageUrl === "string") update.imageUrl = b.imageUrl;
  if (Array.isArray(b.cards)) update.cards = b.cards;
  if (typeof b.isMain === "boolean") update.isMain = b.isMain;
  if (typeof b.autoSendEnabled === "boolean") update.autoSendEnabled = b.autoSendEnabled;
  if ([0, 60, 360, 1440].includes(Number(b.autoSendDelayMinutes))) update.autoSendDelayMinutes = Number(b.autoSendDelayMinutes);
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  await dbConnect();
  const flow = await MetaFlow.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // At most one Main flow per account — demote any sibling when this one is promoted.
  if (update.isMain === true) {
    await MetaFlow.updateMany(
      { _id: { $ne: id }, account: (flow as { account?: string }).account ?? "all", isMain: true },
      { isMain: false }
    );
  }
  return NextResponse.json({ flow });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const { id } = await params;
  await dbConnect();
  const deleted = await MetaFlow.findByIdAndDelete(id).lean();
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
