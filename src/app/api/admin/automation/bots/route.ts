import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import CommentBot from "@/models/CommentBot";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

const strList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map((x) => String(x).trim()).filter(Boolean)
    : String(v || "").split(",").map((x) => x.trim()).filter(Boolean);

interface BotBody {
  id?: string;
  name?: string;
  account?: string;
  platform?: string;
  postId?: string;
  keywords?: unknown;
  matchWholeWord?: boolean;
  commentReply?: string;
  dmText?: string;
  dmImage?: string;
  dmButtons?: { label?: string; url?: string }[];
  collectOrders?: boolean;
  products?: { name?: string; price?: number }[];
  enabled?: boolean;
}

function pickFields(b: BotBody) {
  const out: Record<string, unknown> = {};
  if (b.name !== undefined) out.name = String(b.name).trim().slice(0, 120);
  if (b.account !== undefined) out.account = String(b.account).trim() || "antaqor";
  if (b.platform !== undefined && ["instagram", "messenger", "both"].includes(String(b.platform))) out.platform = b.platform;
  if (b.postId !== undefined) out.postId = String(b.postId).trim();
  if (b.keywords !== undefined) out.keywords = strList(b.keywords).slice(0, 20);
  if (b.matchWholeWord !== undefined) out.matchWholeWord = !!b.matchWholeWord;
  if (b.commentReply !== undefined) out.commentReply = String(b.commentReply).slice(0, 300);
  if (b.dmText !== undefined) out.dmText = String(b.dmText).slice(0, 900);
  if (b.dmImage !== undefined) out.dmImage = String(b.dmImage).slice(0, 500);
  if (Array.isArray(b.dmButtons))
    out.dmButtons = b.dmButtons
      .filter((x) => x?.label && x?.url)
      .slice(0, 3)
      .map((x) => ({ label: String(x.label).slice(0, 20), url: String(x.url).slice(0, 500) }));
  if (b.collectOrders !== undefined) out.collectOrders = !!b.collectOrders;
  if (Array.isArray(b.products))
    out.products = b.products
      .filter((x) => x?.name)
      .slice(0, 6)
      .map((x) => ({ name: String(x.name).slice(0, 60), price: Math.max(0, Number(x.price) || 0) }));
  if (b.enabled !== undefined) out.enabled = !!b.enabled;
  return out;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const bots = await CommentBot.find({}).sort({ updatedAt: -1 }).limit(100).lean();
  return NextResponse.json({ bots });
}

export async function POST(req: NextRequest) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as BotBody | null;
  const fields = pickFields(b || {});
  if (!fields.name) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 });
  if (!Array.isArray(fields.keywords) || (fields.keywords as string[]).length === 0)
    return NextResponse.json({ error: "Дор хаяж нэг түлхүүр үг" }, { status: 400 });
  if (!fields.dmText) return NextResponse.json({ error: "DM мессеж шаардлагатай" }, { status: 400 });
  if (fields.collectOrders && (!Array.isArray(fields.products) || (fields.products as unknown[]).length === 0))
    return NextResponse.json({ error: "Захиалга авахад дор хаяж 1 бүтээгдэхүүн" }, { status: 400 });
  await dbConnect();
  const bot = await CommentBot.create({ ...fields, createdByEmail: s.user?.email || "" });
  return NextResponse.json({ bot }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as BotBody | null;
  if (!b?.id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await dbConnect();
  const bot = await CommentBot.findByIdAndUpdate(b.id, { $set: pickFields(b) }, { new: true }).lean();
  if (!bot) return NextResponse.json({ error: "олдсонгүй" }, { status: 404 });
  return NextResponse.json({ bot });
}

export async function DELETE(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!b?.id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await dbConnect();
  await CommentBot.deleteOne({ _id: b.id });
  return NextResponse.json({ ok: true });
}
