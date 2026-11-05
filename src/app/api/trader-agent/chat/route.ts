import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { TraderMsg } from "@/models/TraderBrain";
import { chat, learnFromChat } from "@/lib/traderLearn";

/* ─── Tesla Trader AI туслах — чат (2026-10-25) ───
   GET  ?scan=<id> → тухайн скан (эсвэл ерөнхий) ярианы түүх
   POST {scanId?, message} → хариулт (санах ой + скан + түүхэд тулгуурласан) → чатаас суралцана.
   Чат үнэгүй (скан төлбөртэй); хэт ашиглалтаас минутад 6 мессеж. */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const rate = new Map<string, number[]>();
async function me() {
  const s = await getServerSession(authOptions);
  return (s?.user as { id?: string } | undefined)?.id || null;
}

export async function GET(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const scan = req.nextUrl.searchParams.get("scan");
  await dbConnect();
  const q = { user: u, scan: scan && /^[a-f0-9]{24}$/i.test(scan) ? scan : null };
  const rows = await TraderMsg.find(q).sort({ createdAt: -1 }).limit(40).select("role text createdAt meta").lean();
  return NextResponse.json({ messages: rows.reverse().map((m) => ({ ...m, _id: String(m._id) })) });
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const now = Date.now(), r = (rate.get(u) || []).filter((t) => now - t < 60e3);
  if (r.length >= 6) return NextResponse.json({ error: "Хэт хурдан байна — хэдэн секунд хүлээгээд асуугаарай" }, { status: 429 });
  rate.set(u, [...r, now]);
  const b = (await req.json().catch(() => ({}))) as { scanId?: string; message?: string };
  const scanId = b.scanId && /^[a-f0-9]{24}$/i.test(b.scanId) ? b.scanId : null;
  try {
    const out = await chat({ user: u, scanId, message: String(b.message || "") });
    const learned = await Promise.race([learnFromChat(u, String(b.message || ""), out.answer), new Promise<string[]>((res) => setTimeout(() => res([]), 12000))]).catch(() => []);
    return NextResponse.json({ answer: out.answer, used: out.used, learned });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Хариулт гарсангүй" }, { status: 500 });
  }
}
