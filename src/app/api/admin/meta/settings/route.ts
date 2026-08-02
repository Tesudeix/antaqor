import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaSettings, { AIProvider } from "@/models/MetaSettings";

export const dynamic = "force-dynamic";

async function getOrCreate() {
  let doc = await MetaSettings.findOne({ singleton: "main" });
  if (!doc) doc = await MetaSettings.create({ singleton: "main" });
  return doc;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const doc = await getOrCreate();
  return NextResponse.json({ settings: doc });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  await dbConnect();
  const doc = await getOrCreate();

  if (typeof body.automationEnabled === "boolean") doc.automationEnabled = body.automationEnabled;
  if (typeof body.aiReplyEnabled === "boolean") doc.aiReplyEnabled = body.aiReplyEnabled;
  if (typeof body.provider === "string" && ["grok", "openai", "claude"].includes(body.provider)) {
    doc.provider = body.provider as AIProvider;
  }
  if (typeof body.aiModel === "string") doc.aiModel = body.aiModel.slice(0, 100);
  if (typeof body.systemPromptOverride === "string") {
    doc.systemPromptOverride = body.systemPromptOverride.slice(0, 4000);
  }
  if (typeof body.fallbackMessage === "string") doc.fallbackMessage = body.fallbackMessage.slice(0, 600);
  if (Array.isArray(body.blacklistWords)) {
    doc.blacklistWords = (body.blacklistWords as unknown[])
      .filter((w): w is string => typeof w === "string")
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 200);
  }
  if (typeof body.businessHoursEnabled === "boolean") doc.businessHoursEnabled = body.businessHoursEnabled;
  if (typeof body.businessHoursStartMin === "number") {
    doc.businessHoursStartMin = Math.max(0, Math.min(1440, body.businessHoursStartMin));
  }
  if (typeof body.businessHoursEndMin === "number") {
    doc.businessHoursEndMin = Math.max(0, Math.min(1440, body.businessHoursEndMin));
  }
  if (typeof body.businessHoursTz === "string") doc.businessHoursTz = body.businessHoursTz.slice(0, 60);
  if (typeof body.businessHoursMessage === "string") {
    doc.businessHoursMessage = body.businessHoursMessage.slice(0, 600);
  }
  if (typeof body.maxRepliesPerUserPerDay === "number") {
    doc.maxRepliesPerUserPerDay = Math.max(0, Math.min(10000, body.maxRepliesPerUserPerDay));
  }
  doc.updatedByEmail = session.user.email || "";
  await doc.save();

  return NextResponse.json({ ok: true, settings: doc });
}
