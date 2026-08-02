import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaWelcome from "@/models/MetaWelcome";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const doc = await MetaWelcome.findOne({ account: "antaqor" }).lean();
  return NextResponse.json({ welcome: doc || {} });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  await dbConnect();

  const set: Record<string, unknown> = {};
  if (typeof b.greeting === "string") set.greeting = b.greeting.slice(0, 1000);
  if (typeof b.enabled === "boolean") set.enabled = b.enabled;
  if (["menu", "flow", "off"].includes(b.welcomeMode as string)) set.welcomeMode = b.welcomeMode;
  if (typeof b.welcomeFlow === "string") set.welcomeFlow = b.welcomeFlow.trim();
  if (["smart","menu","ai","text","flow","human","intent"].includes(b.defaultAction as string)) set.defaultAction = b.defaultAction;
  if (typeof b.defaultText === "string") set.defaultText = b.defaultText.slice(0, 600);
  if (typeof b.businessFaq === "string") set.businessFaq = b.businessFaq.slice(0, 4000);
  if (typeof b.payQrUrl === "string") set.payQrUrl = b.payQrUrl.slice(0, 500);
  if (typeof b.payText === "string") set.payText = b.payText.slice(0, 600);
  if (Array.isArray(b.buttons)) set.buttons = (b.buttons as unknown[]).slice(0, 11);
  if (Array.isArray(b.conversationStarters)) {
    set.conversationStarters = (b.conversationStarters as unknown[])
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .slice(0, 4);
  }

  const doc = await MetaWelcome.findOneAndUpdate(
    { account: "antaqor" },
    { $set: set },
    { new: true, upsert: true }
  ).lean();
  return NextResponse.json({ ok: true, welcome: doc });
}
