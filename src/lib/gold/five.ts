import mongoose, { Schema, type Model as MModel } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { analyze, liveData, fiveModel, spreadNow } from "./service";
import { computeFeatures } from "./features";
import { buildScanCtx, scanAll, scanReady, SCANS, type ScanCtx } from "./scans";
import { consensus, rangePreds, weighted, RANGE_SRC } from "./ensemble";
import { levelsFor, TAIL_K } from "./model";

/* ─── Tesla Trader · 5 SCAN сервис (2026-11-05) ───
   analyzeFive() — таван scan-ийг нэг мөчид, ижил бодит дата дээр ажиллуулж дундаж, санал нийлэлт, хүрээ,
   80%-ийн таамгийн бүсийг гаргана. Дохио зөвхөн түүхэн хэмжилт эерэг үед (FiveReport.on) л BUY/SELL болно.
   Бодит туршилт: M5 хаалт бүрт (хуудас нээгээгүй ч) 5 онооны бүртгэл → 30 минутын дараа бодит үнээр шалгана,
   `goldscanlogs` — backtest биш, хэзээ ч хойш засагдахгүй амьд таамаг. */

type Log = { t: number; s: number[]; mean: number; dir: number; agree: number; px: number; pred: number; move: number | null; rng: number | null };
const ScanLog: MModel<Log> = (mongoose.models.GoldScanLog as MModel<Log>) || mongoose.model<Log>("GoldScanLog", new Schema<Log>({
  t: { type: Number, unique: true }, s: [Number], mean: Number, dir: Number, agree: Number, px: Number, pred: Number, move: { type: Number, default: null }, rng: { type: Number, default: null },
}));

const lastClosed = (c: ScanCtx) => { for (let j = c.m5.length - 1; j >= c.m5.length - 4 && j > 0; j--) if (scanReady(c, j)) return j; return -1; };

/** Хаагдсан M5 лааг бүртгэж, 30 мин болсон таамгуудыг бодит үнээр шалгана */
async function logTick(c: ScanCtx, j: number, s: number[], con: ReturnType<typeof consensus>, pred: number) {
  await dbConnect();
  await ScanLog.updateOne({ t: c.T[j] }, { $setOnInsert: { s, mean: con.mean, dir: con.dir, agree: con.agree, px: c.c[j], pred } }, { upsert: true });
  const due = await ScanLog.find({ move: null, t: { $lt: Date.now() - 36 * 60000 } }).sort({ t: -1 }).limit(300).lean<(Log & { _id: unknown })[]>();
  const at = new Map(c.m5.map((b, k) => [b.t + 300000, k]));
  await Promise.all(due.map(async (d) => {
    const k = at.get(d.t);
    if (k === undefined || k + 6 >= c.m5.length) return ScanLog.deleteOne({ _id: d._id, t: { $lt: c.T[0] } });
    let hi = -Infinity, lo = Infinity;
    for (let q = k + 1; q <= k + 6; q++) { hi = Math.max(hi, c.m5[q].h); lo = Math.min(lo, c.m5[q].l); }
    return ScanLog.updateOne({ _id: d._id }, { $set: { move: +(c.m5[k + 6].c - d.px).toFixed(3), rng: +(hi - lo).toFixed(3) } });
  }));
}
async function liveStats() {
  await dbConnect();
  const rows = await ScanLog.find({ move: { $ne: null } }).sort({ t: -1 }).limit(3000).lean<Log[]>();
  const pct = (w: number, n: number) => (n ? +((w / n) * 100).toFixed(1) : null);
  const by = (f: (r: Log) => number, min = 0.15) => { let w = 0, n = 0; for (const r of rows) { const v = f(r); if (Math.abs(v) < min || !r.move) continue; n++; if (Math.sign(v) === Math.sign(r.move)) w++; } return { n, hit: pct(w, n) }; };
  const strong = rows.filter((r) => r.agree >= 4 && r.dir && r.move);
  const ape = rows.filter((r) => r.rng && r.pred).map((r) => Math.abs(r.rng! / r.pred - 1)).sort((a, b) => a - b);
  return {
    n: rows.length, from: rows[rows.length - 1]?.t ?? null, scans: SCANS.map((x, k) => ({ id: x.id, ...by((r) => r.s[k] ?? 0) })), mean: by((r) => r.mean),
    strong: { n: strong.length, hit: pct(strong.filter((r) => Math.sign(r.move!) === r.dir).length, strong.length) }, rangeApe: ape.length ? +(ape[ape.length >> 1] * 100).toFixed(1) : null,
  };
}

/* 5 минут тутам дэвсгэрт бүртгэнэ. src/instrumentation.ts сервер асахад асаана; instrumentation ба маршрут
   тусдаа bundle тул таймерыг globalThis дээр барьж нэг процесст нэг л удаа ажиллуулна. */
async function tick() {
  const fm = await fiveModel();
  if (!fm) return;
  const D = await liveData(), c = buildScanCtx(D), j = lastClosed(c), fs = computeFeatures(D, { onlyLast: 3 }), S = fs.S[fs.S.length - 1];
  if (j < 0 || !S || Date.now() - c.T[j] > 12 * 60000) return;
  const r = scanAll(c, j);
  await logTick(c, j, r.map((x) => x.score), consensus(r), Math.exp(weighted(fm.range, rangePreds(fm.range, c, S, j))));
}

export function startRecorder() {
  const g = globalThis as { __fiveTimer?: ReturnType<typeof setInterval> };
  if (g.__fiveTimer) return;
  const run = () => { tick().catch((e) => console.error("[five tick]", (e as Error).message)); };
  g.__fiveTimer = setInterval(run, 5 * 60e3);
  g.__fiveTimer.unref?.();
  setTimeout(run, 30e3).unref?.();
}

export async function analyzeFive() {
  startRecorder();
  const [a, D, fm] = await Promise.all([analyze(), liveData(), fiveModel()]);
  const c = buildScanCtx(D);
  c.live = true;
  const j = lastClosed(c);
  if (j < 0) throw new Error("Алтны дата хангалтгүй байна — хэдэн минутын дараа дахин оролдоно уу");
  const results = scanAll(c, j), con = consensus(results), fs = computeFeatures(D, { onlyLast: 3 }), S = fs.S[fs.S.length - 1], mid = (a.price.bid + a.price.ask) / 2;
  c.live = false;
  const trail = Array.from({ length: 36 }, (_, k) => j - 35 + k).filter((q) => scanReady(c, q)).map((q) => ({ t: c.T[q], m: consensus(scanAll(c, q)).mean }));

  /* хүрээ */
  let range = null as null | { preds: number[]; avg: number; band: { lo: number; hi: number }; noiseStop: number; touch: { d: number; p: number }[] };
  if (fm && S) {
    const lp = rangePreds(fm.range, c, S, j), pred = Math.exp(weighted(fm.range, lp)), half = pred * fm.range.band80, tail = fm.range.tail;
    const pAt = (k: number) => { if (k <= TAIL_K[0]) return tail[0] + (100 - tail[0]) * (1 - k / TAIL_K[0]); const i = TAIL_K.findIndex((x) => x >= k); if (i < 0) return tail[tail.length - 1]; const t = (k - TAIL_K[i - 1]) / (TAIL_K[i] - TAIL_K[i - 1]); return tail[i - 1] + (tail[i] - tail[i - 1]) * t; };
    const round = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
    const k25 = TAIL_K.find((_, i) => tail[i] <= 25) ?? 1;
    range = { preds: lp.map((x) => +Math.exp(x).toFixed(2)), avg: +pred.toFixed(2), band: { lo: +(mid - half).toFixed(2), hi: +(mid + half).toFixed(2) }, noiseStop: round(k25 * pred), touch: [...new Set([0.25, 0.5, 0.75, 1, 1.25].map((k) => round(k * pred)))].map((d) => ({ d, p: Math.round(pAt(d / pred)) })) };
    logTick(c, j, results.map((x) => x.score), con, pred).catch((e) => console.error("[five log]", (e as Error).message));
  }

  /* шийдвэр: зөвхөн түүхэн хэмжилт эерэг + шүүлтүүр нээлттэй үед */
  const R = fm?.report, blocked = a.gates.find((g) => !g.ok), rule = R?.rules.find((x) => x.k === Math.min(5, Math.max(2, con.agree)));
  const bin = R?.calib.find((b) => con.mean >= b.lo && con.mean < b.hi), pUp = bin?.pUp ?? 50;
  let decision: "BUY" | "SELL" | "WAIT" = "WAIT", reason: string, plan = null as ReturnType<typeof levelsFor> | null;
  if (!R) reason = "Хэмжилт анх удаа хийгдэж байна (≈1 мин) — дахин дарна уу.";
  else if (blocked) reason = blocked.text;
  else if (R.on && con.dir && con.agree >= R.onK && S) {
    decision = con.dir > 0 ? "BUY" : "SELL";
    plan = levelsFor(con.dir, con.dir > 0 ? a.price.ask : a.price.bid, S, await spreadNow());
    reason = `${con.agree}/5 scan санал нийлж байна, энэ дүрэм түүхэн шалгалтаар эерэг.`;
  } else reason = con.agree >= 3 && con.dir
    ? `${con.agree}/5 scan ${con.dir > 0 ? "өсөх" : "унах"} гэж байна. Гэхдээ ийм санал нийлэлт түүхэнд ${rule?.hit ?? "—"}% зөв байсан, spread хассаны дараа ${(rule?.exp ?? 0) > 0 ? "+" : ""}${rule?.exp ?? "—"}R — дохио биш.`
    : `Scan-ууд санал нийлэхгүй байна (${con.up} өсөх · ${con.dn} унах) — тодорхой таамаг алга.`;
  const fix2 = (x: number) => +x.toFixed(2);
  return {
    ...a, decision, reason, pUp, score: con.mean, thr: 0.4, dirNote: "", vol: null,
    plan: plan && { ...plan, entry: fix2(plan.entry), sl: fix2(plan.sl), tp1: fix2(plan.tp1), tp2: fix2(plan.tp2), risk: fix2(plan.risk), costR: fix2(plan.costR) },
    band: range?.band, drivers: [], model: a.model,
    five: {
      con, scans: results.map((r, k) => ({ ...r, mn: SCANS[k].mn, sub: SCANS[k].sub, range: range?.preds[k] ?? null, rangeSrc: RANGE_SRC[k], stat: R?.scans[k] ?? null })),
      trail, range, report: R ?? null, rangeStat: fm && { src: RANGE_SRC, r2: fm.range.r2, ape: fm.range.ape, w: fm.range.w, r2Eq: fm.range.r2Eq, apeEq: fm.range.apeEq, r2W: fm.range.r2W, apeW: fm.range.apeW, band80: fm.range.band80, n: fm.range.n },
      live: await liveStats().catch(() => null),
    },
  };
}
