import mongoose, { Schema, type Model as MModel } from "mongoose";
import dbConnect from "@/lib/mongodb";
import type { Bar } from "../scalp/ind";
import { bars, deep, closedOf, quote, withLive, SYMBOLS, TFS, type Sym, type TF } from "./market";
import { ctxOf, measure, indicator, STRATS, type Stat, type Strat } from "./engine";

/* ─── Tesla Trader · чартын дата ба стратегийн түүхэн хэмжилт (2026-11-06) ───
   Стратеги бүрийн хэмжилт (spread/шимтгэл хассан R) 24 цаг тутам шинэчлэгдэнэ. Уншилт нь truth.ts-д. */

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
export async function stats() {
  if (!G.__deskStats || Date.now() - G.__deskStats.at > DAY) { await dbConnect(); const d = await StatDoc.findOne({ key: "all" }).lean<{ data: Record<string, Stat>; at: number }>(); if (d) G.__deskStats = { data: d.data, at: d.at }; }
  if (!G.__deskRun && (!G.__deskStats || Date.now() - G.__deskStats.at > DAY)) G.__deskRun = refresh().catch((e) => console.error("[desk stats]", (e as Error).message)).finally(() => { G.__deskRun = null; });
  return G.__deskStats;
}

const rnd = (x: number, d: number) => (Number.isFinite(x) ? +x.toFixed(d) : null);
export type IndReq = { id: string; p?: number };
/** Чартын дата: сүүлийн 400 лаа (үүсч буй лаа бодит үнээр), индикаторын шугамууд */
export async function chart(sym: Sym, tf: TF, inds: IndReq[]) {
  const [raw0, q] = await Promise.all([bars(sym, tf), quote(sym).catch(() => null)]), raw = withLive(raw0, tf, q?.px ?? 0, q?.t), d = SYMBOLS[sym].digits, from = Math.max(0, raw.length - 400);
  const out = inds.map((w) => indicator(w.id, w.p, raw, d)).filter((v): v is NonNullable<typeof v> => !!v);
  const slice = (v: number[]) => v.slice(from).map((y) => rnd(y, Math.abs(y) < 10 ? 4 : d));
  const i = raw.length - 1;
  return { bars: raw.slice(from).map((b) => [b.t, rnd(b.o, d + 1), rnd(b.h, d + 1), rnd(b.l, d + 1), rnd(b.c, d + 1)]), inds: out.map((o) => ({ id: o.id, label: o.label, pane: o.pane, ref: o.ref, read: o.read(i), vote: o.vote(i), lines: o.lines.map((l) => ({ name: l.name, dots: l.dots, v: slice(l.v) })) })), serverNow: Date.now() };
}

export const verdict = (s: Stat | undefined) => {
  if (!s || !s.fired) return { k: "none", mn: "Хэмжилт алга" };
  if (s.fired < 30) return { k: "few", mn: "Дата бага" };
  const e = s.exp ?? 0, se = s.se ?? 0;
  return e - se > 0.02 ? { k: "pos", mn: "Эерэг" } : e + se < 0 ? { k: "neg", mn: "Сөрөг" } : { k: "zero", mn: "Давуу талгүй" };
};
