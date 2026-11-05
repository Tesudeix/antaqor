import mongoose, { Schema, type Model as MModel } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { bars, closedOf, SYMBOLS, type Sym, type TF } from "./market";
import { ctxOf, ctxReady, structureAt, planAt, follow, STRATS, type Plan, type Strat } from "./engine";

/* ─── Tesla Trader · үр дүнгээс суралцах (2026-11-06) ───
   Төлөвлөгөө бүрийг үүссэн мөчид нь бүртгэж, дараа нь бодит лаагаар дагана — засагдахгүй амьд түүх.
   Хуудас нээгээгүй ч 5 минут тутам ажиллана. Сургамж: хугацаа бүрт түүхэн + амьд дүнгээр стратеги эрэмбэлнэ,
   амьд үр дүн 3 дахин жинтэй (шинэ бодит дата хуучин backtest-ээс чухал). Босгыг автоматаар сулруулахгүй. */

type Rec = { key: string; sym: string; tf: string; strat: string; t: number; dir: number; lo: number; hi: number; entry: number; sl: number; tp1: number; tp2: number; rr: number; rsiConfirm: boolean; status: string; fired: boolean; r: number | null; at: number | null };
const PlanDoc: MModel<Rec> = (mongoose.models.DeskPlan as MModel<Rec>) || mongoose.model<Rec>("DeskPlan", new Schema<Rec>({
  key: { type: String, unique: true }, sym: String, tf: String, strat: String, t: Number, dir: Number, lo: Number, hi: Number, entry: Number, sl: Number, tp1: Number, tp2: Number, rr: Number, rsiConfirm: Boolean,
  status: { type: String, default: "open", index: true }, fired: { type: Boolean, default: false }, r: { type: Number, default: null }, at: { type: Number, default: null },
}));
const TRACK: TF[] = ["15m", "1H", "4H"];

async function tick() {
  await dbConnect();
  for (const sym of Object.keys(SYMBOLS) as Sym[]) for (const tf of TRACK) {
    const b = closedOf(await bars(sym, tf), tf), x = ctxOf(b, tf, SYMBOLS[sym].cost), i = b.length - 1;
    if (!ctxReady(x, i)) continue;
    const st = structureAt(x, i);
    for (const strat of Object.keys(STRATS) as Strat[]) {
      const p = planAt(x, i, st, strat);
      if ("none" in p || p.rr < 1) continue;
      const key = `${sym}:${tf}:${strat}:${p.dir}:${Math.round(p.entry / (0.5 * st.a))}`;
      await PlanDoc.updateOne({ key }, { $setOnInsert: { key, sym, tf, strat, t: b[i].t, dir: p.dir, lo: p.lo, hi: p.hi, entry: p.entry, sl: p.sl, tp1: p.tp1, tp2: p.tp2, rr: p.rr, rsiConfirm: p.rsiConfirm } }, { upsert: true });
    }
    const open = await PlanDoc.find({ sym, tf, status: "open" }).limit(200).lean<(Rec & { _id: unknown })[]>();
    for (const r of open) {
      const k = b.findIndex((q) => q.t === r.t);
      if (k < 0) { if (r.t < b[0].t) await PlanDoc.updateOne({ _id: r._id }, { $set: { status: "stale" } }); continue; }
      const f = follow(x, k, { strat: r.strat as Strat, dir: r.dir, lo: r.lo, hi: r.hi, entry: r.entry, sl: r.sl, tp1: r.tp1, tp2: r.tp2, rr: r.rr, rr2: r.rr, rsiConfirm: r.rsiConfirm, live: false, basis: "" } as Plan);
      const done = ["tp", "sl", "time", "cancel", "missed"].includes(f.end) || (f.end === "expired" && b.length - 1 >= k + 40);
      if (done) await PlanDoc.updateOne({ _id: r._id }, { $set: { status: f.end, fired: f.fired, r: f.fired ? +f.r.toFixed(3) : null, at: b[f.exit]?.t ?? Date.now() } });
    }
  }
}
export function startDeskRecorder() {
  const g = globalThis as { __deskTimer?: ReturnType<typeof setInterval> };
  if (g.__deskTimer) return;
  const run = () => { tick().catch((e) => console.error("[desk learn]", (e as Error).message)); };
  g.__deskTimer = setInterval(run, 5 * 60e3);
  g.__deskTimer.unref?.();
  setTimeout(run, 45e3).unref?.();
}
export type LiveStat = { n: number; open: number; tp: number; sl: number; exp: number | null };
export async function liveStats(sym: Sym) {
  await dbConnect();
  const rows = await PlanDoc.find({ sym }).sort({ t: -1 }).limit(1500).lean<Rec[]>(), by: Record<string, LiveStat & { sum: number }> = {};
  for (const r of rows) {
    const k = `${r.tf}:${r.strat}`, s = (by[k] ??= { n: 0, open: 0, tp: 0, sl: 0, exp: null, sum: 0 });
    if (r.status === "open") { s.open++; continue; }
    if (!r.fired) continue;
    s.n++; s.sum += r.r ?? 0; if (r.status === "tp") s.tp++; if (r.status === "sl") s.sl++;
  }
  Object.values(by).forEach((s) => { s.exp = s.n ? +(s.sum / s.n).toFixed(3) : null; });
  const closed = rows.filter((r) => r.fired && r.status !== "open");
  return {
    by, total: rows.length, open: rows.filter((r) => r.status === "open").length, fired: closed.length, tp: closed.filter((r) => r.status === "tp").length, sl: closed.filter((r) => r.status === "sl").length,
    recent: closed.slice(0, 12).map((r) => ({ tf: r.tf, strat: r.strat, dir: r.dir, status: r.status, r: r.r, t: r.t })),
  };
}
