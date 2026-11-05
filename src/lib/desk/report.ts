import mongoose, { Schema, type Model as MModel } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { news } from "../scalp/feeds";
import type { Bar } from "../scalp/ind";
import { bars, deep, closedOf, quote, SYMBOLS, TFS, TF_MIN, type Sym, type TF } from "./market";
import { ctxOf, ctxReady, structureAt, planAt, patternAt, measure, indicator, STRATS, type Ctx, type Plan, type Stat, type Strat, type Structure, type Pattern } from "./engine";

/* ─── Tesla Trader · Шинжилгээний ширээ — тайлан (2026-11-06) ───
   Хугацаа бүрийн бүтэц → нөхцөлт төлөвлөгөө → хүчингүй болох нөхцөл → таамгийн замтай чарт.
   Текст бүр бодит тооноос угсарна, AI дуудахгүй: тоо зохиогдохгүй, кредитгүй, агшин зуур.
   Төлөвлөгөө бүрийн хажууд ижил дүрмийн түүхэн хэмжилт (spread/шимтгэл хассан R), 24 цаг тутам шинэчлэгдэнэ. */

const StatDoc: MModel<{ key: string; data: Record<string, Stat>; at: number }> = (mongoose.models.DeskStat as MModel<{ key: string; data: Record<string, Stat>; at: number }>) ||
  mongoose.model("DeskStat", new Schema({ key: { type: String, unique: true }, data: Schema.Types.Mixed, at: Number }));
const G = globalThis as { __deskStats?: { data: Record<string, Stat>; at: number } | null; __deskRun?: Promise<void> | null };
const DAY = 24 * 3600e3;

async function refresh() {
  const data: Record<string, Stat> = {};
  for (const sym of Object.keys(SYMBOLS) as Sym[]) for (const tf of TFS) {
    const b = closedOf(await deep(sym, tf).catch(() => [] as Bar[]), tf);
    if (b.length < 300) continue;
    const x = ctxOf(b, tf, SYMBOLS[sym].cost);
    for (const s of Object.keys(STRATS) as Strat[]) data[`${sym}:${tf}:${s}`] = await measure(x, s);
  }
  await dbConnect();
  const at = Date.now();
  await StatDoc.updateOne({ key: "all" }, { $set: { data, at } }, { upsert: true });
  G.__deskStats = { data, at };
}
async function stats() {
  if (!G.__deskStats || Date.now() - G.__deskStats.at > DAY) { await dbConnect(); const d = await StatDoc.findOne({ key: "all" }).lean<{ data: Record<string, Stat>; at: number }>(); if (d) G.__deskStats = { data: d.data, at: d.at }; }
  if (!G.__deskRun && (!G.__deskStats || Date.now() - G.__deskStats.at > DAY)) G.__deskRun = refresh().catch((e) => console.error("[desk stats]", (e as Error).message)).finally(() => { G.__deskRun = null; });
  return G.__deskStats;
}

const rnd = (x: number, d: number) => (Number.isFinite(x) ? +x.toFixed(d) : null);
export type IndReq = { id: string; p?: number };
function pane(raw: Bar[], x: Ctx | null, sym: Sym, inds: IndReq[], st?: Structure | null, plan?: Plan | null, pat?: Pattern) {
  const d = SYMBOLS[sym].digits, from = Math.max(0, raw.length - 150), out = inds.map((q) => indicator(q.id, q.p, raw, d)).filter((v): v is NonNullable<typeof v> => !!v);
  const slice = (v: number[]) => v.slice(from).map((y) => rnd(y, Math.abs(y) < 10 ? 4 : d));
  return {
    bars: raw.slice(from).map((b) => [b.t, b.o, b.h, b.l, b.c]), inds: out.map((o) => ({ label: o.label, pane: o.pane, ref: o.ref, lines: o.lines.map((l) => ({ name: l.name, dots: l.dots, v: slice(l.v) })) })),
    swings: (st?.z || []).filter((s) => x && s.i < x.bars.length && x.bars[s.i].t >= raw[from].t).map((s) => ({ t: x!.bars[s.i].t, p: s.p, label: s.label })),
    plan: plan ?? null, pattern: pat ? { neck: pat.neck, name: pat.name } : null,
  };
}
export async function chart(sym: Sym, tf: TF, inds: IndReq[]) {
  const raw = await bars(sym, tf), cl = closedOf(raw, tf), x = ctxOf(cl, tf, SYMBOLS[sym].cost), st = ctxReady(x, cl.length - 1) ? structureAt(x, cl.length - 1) : null;
  return pane(raw, x, sym, inds, st);
}

const verdict = (s: Stat | undefined) => {
  if (!s || !s.fired) return { k: "none", mn: "Хэмжилт алга" };
  if (s.fired < 30) return { k: "few", mn: "Дата бага" };
  const e = s.exp ?? 0, se = s.se ?? 0;
  return e - se > 0.02 ? { k: "pos", mn: "Эерэг" } : e + se < 0 ? { k: "neg", mn: "Сөрөг" } : { k: "zero", mn: "Давуу талгүй" };
};

export async function report(o: { sym: Sym; strat: Strat; tfs: TF[]; inds: IndReq[] }) {
  const { sym, strat } = o, S = SYMBOLS[sym], d = S.digits, tfs = [...o.tfs].sort((a, b) => TF_MIN[b] - TF_MIN[a]);
  const n2 = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  const when = (t: number) => new Date(t).toLocaleString("en-GB", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" }).replace(",", "");
  const emaReq = o.inds.find((q) => q.id === "ema"), rsiReq = o.inds.find((q) => q.id === "rsi"), emaN = emaReq?.p || 9, rsiN = rsiReq?.p || 14;
  const [st0, ev, q] = await Promise.all([stats(), news(), quote(sym)]);
  const sections = await Promise.all(tfs.map(async (tf) => {
    const raw = await bars(sym, tf), cl = closedOf(raw, tf), x = ctxOf(cl, tf, S.cost, emaN, rsiN), i = cl.length - 1;
    if (!ctxReady(x, i)) return { tf, score: 0, empty: true as const };
    const st = structureAt(x, i), r = planAt(x, i, st, strat), plan = "none" in r ? null : r, pat = patternAt(x, i, st.z), stat = st0?.data[`${sym}:${tf}:${strat}`];
    const out = o.inds.map((w) => indicator(w.id, w.p, cl, d)).filter((v): v is NonNullable<typeof v> => !!v);
    const state = st.dir > 0 ? "Өсөх бүтэц (HH/HL)" : st.dir < 0 ? "Унах бүтэц (LH/LL)" : st.bos < 0 ? "Унах тал руу шилжиж байна" : st.bos > 0 ? "Өсөх тал руу шилжиж байна" : "Холимог бүтэц";
    const notes: string[] = [];
    if (st.bos) notes.push(`Хаалт сүүлийн ${st.bos < 0 ? `ёроол ${n2(st.L.p)}-аас доош` : `оргил ${n2(st.H.p)}-аас дээш`} гарсан — бүтэц эвдэрсэн.`);
    if (st.sweep) notes.push(`${when(st.sweep.t)}-ийн лаа ${n2(st.sweep.level)} түвшинг ${n2(st.sweep.wick)} хүртэл цоолоод буцаж хаагдсан — энэ бол шүүрдэлт, түвшин ${st.sweep.dir > 0 ? "доош" : "дээш"} хүлээн зөвшөөрөгдөөгүй.`);
    notes.push(`Үнэ EMA(${emaN}) ${n2(st.ema)}-ээс ${st.c > st.ema ? "дээгүүр" : "доогуур"}, RSI(${rsiN}) ${st.rsi.toFixed(1)}.`);
    if (st.rsi < 32 && st.score < 0) notes.push(`RSI хэт зарагдсан бүсэд (сүүлд ${st.rMin.toFixed(1)}) — энд хөөцөлдөж зарахгүй, буцалт хүлээнэ.`);
    if (st.rsi > 68 && st.score > 0) notes.push(`RSI хэт авагдсан бүсэд (сүүлд ${st.rMax.toFixed(1)}) — энд хөөцөлдөж авахгүй, буцалт хүлээнэ.`);
    const patText = pat && (pat.status === "failed" ? `${pat.name}: хүзүү ${n2(pat.neck)} эвдэрсэн ч буцаж алдагдсан — сул хувилбар. ${n2(pat.neck)}-ийг дахин авч тогтвол хүчирхэгжинэ.` : pat.status === "active" ? `${pat.name}: хүзүү ${n2(pat.neck)} эвдэрсэн, загвар идэвхтэй.` : `${pat.name} хэлбэржиж байна: ${n2(pat.neck)} эвдрэхийг хүлээнэ.`);
    const side = plan && (plan.dir > 0 ? "дээш" : "доош");
    const confirm = plan && (strat === "pullback" ? `Бүсэд татгалзаж, ${n2(plan.entry)}-ийн ${side} хаагдаад RSI ${plan.dir > 0 ? "дээш" : "доош"} эргэх` : strat === "sweep" ? `Түвшинг цоолоод ${n2(plan.entry)}-ийн ${side} буцаж хаагдах` : `Бүсэд хүрч ${n2(plan.entry)}-ийн ${side} хаагдах`);
    const invalid = plan ? `${n2(plan.sl)} давбал төлөвлөгөө хүчингүй.${pat?.status === "failed" && pat.dir !== plan.dir ? ` ${n2(pat.neck)}-ийг тогтвортой авбал ${pat.name.toLowerCase()} хувилбарыг дахин үнэлнэ.` : ""}${plan.rsiConfirm ? ` Татгалзалгүйгээр RSI ${plan.dir > 0 ? "буурвал" : "өсвөл"} эхний буцалтад орохгүй.` : ""}` : "";
    return {
      tf, score: st.score, state, price: st.c, swings: st.z.slice(-6).map((s) => ({ label: s.label, p: s.p, t: x.bars[s.i].t })), notes, pattern: patText,
      inds: out.map((v) => ({ label: v.label, read: v.read(i) })), plan, none: "none" in r ? r.none : null, confirm, invalid, atr: rnd(st.a, d),
      stat: stat ?? null, verdict: verdict(stat), pane: pane(raw, x, sym, o.inds, st, plan, pat),
    };
  }));
  const ready = sections.filter((s) => !("empty" in s));
  const wt = (tf: TF) => Math.log2(TF_MIN[tf] + 1), sum = ready.reduce((a, s) => a + wt(s.tf) * s.score, 0) / (ready.reduce((a, s) => a + wt(s.tf), 0) || 1);
  const bias = sum >= 1 ? { k: 1, mn: "Өсөх" } : sum >= 0.4 ? { k: 0.5, mn: "Саармаг-Авах" } : sum <= -1 ? { k: -1, mn: "Унах" } : sum <= -0.4 ? { k: -0.5, mn: "Саармаг-Зарах" } : { k: 0, mn: "Саармаг" };
  const dirs = ready.map((s) => (s.score > 0.5 ? 1 : s.score < -0.5 ? -1 : 0)), agree = dirs.every((x) => x === dirs[0]);
  const now = Date.now();
  return {
    sym, pair: S.pair, strat, stratMn: STRATS[strat].mn, now, price: q, bias, biasScore: +sum.toFixed(2),
    summary: `${ready.map((s) => `${s.tf}: ${(s as { state: string }).state}`).join(" · ")}. ${agree ? "Хугацаанууд нэг чиглэлтэй." : "Хугацаанууд зөрчилтэй — чиглэлийг том хугацаагаар хэмжиж, жижиг хугацаанд хөөцөлдөхгүй."}`,
    sections, statsAt: st0?.at ?? null, measuring: !!G.__deskRun,
    news: ev.filter((e) => S.ccy.includes(e.ccy) && e.impact !== "Low" && e.t > now - 3600e3 && e.t - now < 36 * 3600e3).sort((a, b) => a.t - b.t).slice(0, 6),
  };
}
export async function newsFor(sym: Sym) {
  const ev = await news(), now = Date.now();
  return ev.filter((e) => SYMBOLS[sym].ccy.includes(e.ccy) && e.impact !== "Low" && e.t > now - 6 * 3600e3).sort((a, b) => a.t - b.t).slice(0, 30);
}
