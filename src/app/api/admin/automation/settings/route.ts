import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaWelcome from "@/models/MetaWelcome";

export const dynamic = "force-dynamic";

// Тохиргоо tab — MetaWelcome-ийн хэрэгтэй хэсэг л (Тавтай морил хуудсыг залгисан).
// welcome toggle + greeting + starters (max 4) · fallback · төлбөрийн мэдээлэл.

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

const FALLBACKS = ["smart", "menu", "ai", "text"];

export async function GET(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const account = req.nextUrl.searchParams.get("account") || "antaqor";
  const w = await MetaWelcome.findOne({ account }).lean();
  return NextResponse.json({
    account,
    enabled: w?.enabled !== false && (w?.welcomeMode || "menu") !== "off",
    greeting: w?.greeting || "",
    conversationStarters: (w?.conversationStarters || []).slice(0, 4),
    defaultAction: FALLBACKS.includes(String(w?.defaultAction)) ? w?.defaultAction : "smart",
    defaultText: w?.defaultText || "",
    businessFaq: w?.businessFaq || "",
    payText: w?.payText || "",
  });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as {
    account?: string;
    enabled?: boolean;
    greeting?: string;
    conversationStarters?: unknown;
    defaultAction?: string;
    defaultText?: string;
    businessFaq?: string;
    payText?: string;
  } | null;
  if (!b) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await dbConnect();
  const account = String(b.account || "antaqor");
  const starters = Array.isArray(b.conversationStarters)
    ? (b.conversationStarters as unknown[]).map((s) => String(s).trim()).filter(Boolean).slice(0, 4)
    : undefined;

  const set: Record<string, unknown> = {};
  if (b.enabled !== undefined) set.welcomeMode = b.enabled ? "menu" : "off";
  if (b.enabled !== undefined) set.enabled = !!b.enabled;
  if (b.greeting !== undefined) set.greeting = String(b.greeting).slice(0, 900);
  if (starters !== undefined) set.conversationStarters = starters;
  if (b.defaultAction !== undefined && FALLBACKS.includes(String(b.defaultAction))) set.defaultAction = b.defaultAction;
  if (b.defaultText !== undefined) set.defaultText = String(b.defaultText).slice(0, 900);
  if (b.businessFaq !== undefined) set.businessFaq = String(b.businessFaq).slice(0, 6000);
  if (b.payText !== undefined) set.payText = String(b.payText).slice(0, 900);

  await MetaWelcome.findOneAndUpdate({ account }, { $set: set }, { upsert: true });
  return NextResponse.json({ ok: true });
}
