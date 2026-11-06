import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SYMBOLS, TFS, quote, type Sym, type TF } from "@/lib/desk/market";
import { INDICATORS, STRATS, type Strat } from "@/lib/desk/engine";
import { chart, report, newsFor, type IndReq } from "@/lib/desk/report";
import { weigh } from "@/lib/desk/news";

/* ─── Tesla Trader · Шинжилгээний ширээ API (2026-11-06) ───
   GET ?q=price&sym · GET ?q=news&sym · GET ?sym&tf&ind=ema:9,rsi:14 → чарт
   POST {sym, strat, tfs[≤3], inds[≤18]} → олон хугацааны тайлан. AI дуудахгүй. */
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
    if (q.get("q") === "news") return NextResponse.json({ news: await newsFor(sym) }, noStore);
    if (q.get("q") === "weigh") return NextResponse.json(await weigh(sym), noStore);
    const inds = cleanInds((q.get("ind") || "").split(",").filter(Boolean).map((s) => { const [id, p] = s.split(":"); return { id, p }; }));
    return NextResponse.json(await chart(sym, tf, inds), noStore);
  } catch (e) { console.error("[desk]", (e as Error).message); return NextResponse.json({ error: "Ханшийн дата түр ирэхгүй байна" }, { status: 502 }); }
}

export async function POST(req: NextRequest) {
  if (!(await auth())) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { sym?: unknown; strat?: unknown; tfs?: unknown[]; inds?: { id?: unknown; p?: unknown }[] };
  const tfs = (Array.isArray(b.tfs) ? b.tfs : []).filter(okTf).slice(0, 3);
  if (!okSym(b.sym) || typeof b.strat !== "string" || !(b.strat in STRATS) || !tfs.length) return NextResponse.json({ error: "Стратеги, хугацаагаа сонгоно уу" }, { status: 400 });
  try { return NextResponse.json(await report({ sym: b.sym, strat: b.strat as Strat, tfs: [...new Set(tfs)], inds: cleanInds(Array.isArray(b.inds) ? b.inds : []) }), noStore); }
  catch (e) { console.error("[desk report]", (e as Error).message); return NextResponse.json({ error: "Шинжилгээ амжилтгүй — дахин оролдоно уу" }, { status: 502 }); }
}
