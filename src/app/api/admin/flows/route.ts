import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaFlow from "@/models/MetaFlow";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  await dbConnect();
  const flows = await MetaFlow.find().sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ flows });
}

export async function POST(req: NextRequest) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const b = await req.json();
  if (!b.name?.trim()) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 });
  await dbConnect();
  const account = typeof b.account === "string" ? b.account : "all";
  const flow = await MetaFlow.create({
    name: b.name.trim(),
    platform: ["instagram", "messenger", "both"].includes(b.platform) ? b.platform : "both",
    triggerKeywords: Array.isArray(b.triggerKeywords) ? b.triggerKeywords : [],
    matchMode: b.matchMode || "contains",
    entryCardId: b.entryCardId || "",
    account,
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : "",
    cards: Array.isArray(b.cards) ? b.cards : [],
    isMain: !!b.isMain,
    autoSendEnabled: !!b.autoSendEnabled,
    autoSendDelayMinutes: [0, 60, 360, 1440].includes(Number(b.autoSendDelayMinutes)) ? Number(b.autoSendDelayMinutes) : 1440,
    enabled: !!b.enabled,
    createdByEmail: s.user?.email || "",
  });
  // At most one Main flow per account — demote any sibling.
  if (flow.isMain) {
    await MetaFlow.updateMany({ _id: { $ne: flow._id }, account, isMain: true }, { isMain: false });
  }
  return NextResponse.json({ flow }, { status: 201 });
}
