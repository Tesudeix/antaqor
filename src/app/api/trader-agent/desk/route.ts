import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SYMBOLS, TFS, quote, type Sym, type TF } from "@/lib/desk/market";
import { INDICATORS } from "@/lib/desk/engine";
import { chart, type IndReq } from "@/lib/desk/report";
import { read } from "@/lib/desk/truth";

/* ─── Tesla Trader · ширээний API (2026-11-06) ───
   GET ?q=price&sym · GET ?q=read&sym&tf → 18 индикаторын уншилт + үнэн шалгалт · GET ?sym&tf&ind=ema:9,rsi:14 → чарт */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const auth = async () => !!(await getServerSession(authOptions))?.user;
const okSym = (s: unknown): s is Sym => typeof s === "string" && s in SYMBOLS;
const okTf = (s: unknown): s is TF => TFS.includes(s as TF);
const cleanInds = (a: { id?: unknown; p?: unknown }[]): IndReq[] => a.filter((x) => INDICATORS.some((q) => q.id === x.id)).slice(0, 18).map((x) => ({ id: String(x.id), p: Number(x.p) || undefined }));
const noStore = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const q = req.nextUrl.searchParams, sym = q.get("sym") || "XAUUSD", tf = q.get("tf") || "1H";
  if (!okSym(sym) || !okTf(tf)) return NextResponse.json({ error: "Буруу хүсэлт" }, { status: 400 });
  try {
    if (q.get("q") === "price") return NextResponse.json(await quote(sym), noStore);
    if (q.get("q") === "read") return NextResponse.json(await read(sym, tf), noStore);
    const inds = cleanInds((q.get("ind") || "").split(",").filter(Boolean).map((s) => { const [id, p] = s.split(":"); return { id, p }; }));
    return NextResponse.json(await chart(sym, tf, inds), noStore);
  } catch (e) { console.error("[desk]", (e as Error).message); return NextResponse.json({ error: "Ханшийн дата түр ирэхгүй байна" }, { status: 502 }); }
}
