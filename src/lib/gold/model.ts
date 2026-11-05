import type { Bar } from "../scalp/ind";
import { simulate } from "../scalp/engine";
import type { FeatureSet, Sample } from "./features";

/* ─── Tesla Trader · XAU/USD «өндөр сигнал, бага шуугиан» модель (2026-11-05) ───
   1) Онцлог бүрийг сургалтын дата дээр стандартчилна (±4σ хайчилна).
   2) Горим бүрт (тренд / хүрээ) IC = corr(онцлог, дараагийн 30 мин өгөөж / ATR). Сургалтыг хоёр хагаслаж,
      ХОЁУЛАНД нь ижил тэмдэгтэй, хангалттай хүчтэй бол л «сигнал» — бусад нь «шуугиан».
   3) Давхардал хасах: сонгогдсон онцлогууд хоорондоо |corr| < 0.55 (нэг мэдээллийг хоёр тоолохгүй), ≤ 10.
   4) Нийлбэр оноо S = Σ IC·z, стандартчилсан; |S| ≥ босго (сургалтын 85-р хувь) үед л дохио.
   5) Walk-forward: өгөгдлийн 40%-иас эхлэн 14 хоног тутам ЗӨВХӨН өмнөх датагаар дахин сургаж, дараагийн
      14 хоногийг таана — сургалтад ороогүй бүх таамгийг нэгтгэж spread хассан арилжаагаар үнэлнэ.
      Тухайн горимд walk-forward давуу тал эерэг биш бол тэр горимд дохио өгөхгүй (Model.on). */

export const SPREAD = 0.25;          /* алтны ердийн бүх-зардал spread ($) */
export let MAX_BARS = 45;
export const setMaxBars = (n: number) => { MAX_BARS = n; };
const MIN_IC = 0.03, MIN_HALF = 0.015, MAX_CORR = 0.55, MAX_SEL = 10, THR_Q = 0.85, FOLD = 14 * 864e5;

export type Sel = { key: string; fam: string; mn: string; w: number; ic: number; icA: number; icB: number };
type Fitted = { norm: Record<string, [number, number]>; reg: { sel: Sel[]; sMu: number; sSd: number; thr: number }[]; ic: [number, number][]; stable: [boolean, boolean][]; picked: [boolean, boolean][] };
export type Eval = { n: number; ic: number | null; signals: number; hit: number | null; trades: number; tp1: number; win: number; exp: number | null; se: number | null; totalR: number; maxDD: number };
/** Хэлбэлзлийн таамаг: log(дараагийн 30 мин хүрээ) = β₀ + β₁·log(ATR) + β₂·log(30 мин хүрээ) + β₃·log(2 цаг хүрээ) + β₄·өдрийн цагийн улирал */
export type VolModel = { beta: number[]; season: number[]; r2: number; n: number; mape: number; tail: number[]; cover80: number };
export type Screen = { key: string; fam: string; mn: string; ic: [number, number]; picked: [boolean, boolean]; folds: [number, number] };
export type Model = {
  fittedAt: number; from: number; to: number; samples: number; folds: number; wfFrom: number;
  norm: Record<string, [number, number]>; reg: Fitted["reg"]; wf: [Eval, Eval]; ins: [Eval, Eval]; on: [boolean, boolean];
  screen: Screen[]; total: number; recent: { t: number; dir: number; r: number; regime: number }[];
  /** walk-forward таамгаас: онооны мужаар дараагийн 30 минутад өссөн хувь (Beta(10,10)-аар татсан) */
  calib: { lo: number; hi: number; n: number; pUp: number }[];
  vol: VolModel;
};
const BINS = [-99, -1.5, -0.75, -0.25, 0.25, 0.75, 1.5, 99];

function corr(a: ArrayLike<number>, b: ArrayLike<number>, idx: number[]): number {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
  for (const i of idx) { const x = a[i], y = b[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; n++; }
  const cv = n * sxy - sx * sy, vx = n * sxx - sx * sx, vy = n * syy - sy * sy;
  return n > 30 && vx > 0 && vy > 0 ? cv / Math.sqrt(vx * vy) : 0;
}
const quant = (arr: number[], p: number) => { const s = [...arr].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const zOf = (x: number, [mu, sd]: [number, number]) => (Number.isFinite(x) ? Math.max(-4, Math.min(4, (x - mu) / sd)) : 0);

/** Дохионы түвшин: SL = сүүлийн 6 M5 лааны swing-ийн цаана + 0.2 ATR, 1–2 ATR(M5)-д хавчина; TP1 1R, TP2 2R */
export function levelsFor(dir: number, entry: number, s: Pick<Sample, "a5" | "swingLo" | "swingHi">, spread = SPREAD) {
  const a = s.a5;
  let risk = dir > 0 ? entry - (s.swingLo - 0.2 * a) : s.swingHi + 0.2 * a - entry;
  risk = Math.max(1.0 * a, Math.min(2.0 * a, Number.isFinite(risk) && risk > 0 ? risk : 1.5 * a), 5 * spread);
  return { entry, sl: entry - dir * risk, tp1: entry + dir * risk, tp2: entry + dir * 2 * risk, risk, rr2: 2, costR: spread / risk };
}

function fitOn(fs: FeatureSet, train: number[]): Fitted {
  const { S, X, defs } = fs;
  const norm: Record<string, [number, number]> = {};
  const Z = defs.map((d, n) => {
    let s = 0, s2 = 0, c = 0;
    for (const i of train) { const x = X[n][i]; if (Number.isFinite(x)) { s += x; s2 += x * x; c++; } }
    const mu = c ? s / c : 0, sd = c ? Math.sqrt(Math.max(1e-12, s2 / c - mu * mu)) : 1;
    norm[d.key] = [mu, sd];
    return Float64Array.from(X[n], (x) => zOf(x, [mu, sd]));
  });
  const y = Float64Array.from(S, (s) => (Number.isFinite(s.y) ? Math.max(-4, Math.min(4, s.y)) : NaN));
  const ic: [number, number][] = defs.map(() => [0, 0]), stable: [boolean, boolean][] = defs.map(() => [false, false]), picked: [boolean, boolean][] = defs.map(() => [false, false]);
  const reg = [0, 1].map((r) => {
    const tr = train.filter((i) => S[i].regime === r), A = tr.slice(0, tr.length >> 1), B = tr.slice(tr.length >> 1);
    const cand = defs.map((d, n) => {
      const v = corr(Z[n], y, tr), a = corr(Z[n], y, A), b = corr(Z[n], y, B);
      const ok = Math.sign(a) === Math.sign(b) && Math.min(Math.abs(a), Math.abs(b)) >= MIN_HALF && Math.abs(v) >= MIN_IC;
      ic[n][r] = +v.toFixed(3); stable[n][r] = ok;
      return { n, d, v, a, b, ok };
    }).filter((c) => c.ok).sort((p, q) => Math.abs(q.v) - Math.abs(p.v));
    const pick: typeof cand = [];
    for (const c of cand) {
      if (pick.length >= MAX_SEL) break;
      if (pick.every((p) => Math.abs(corr(Z[p.n], Z[c.n], tr)) < MAX_CORR)) { pick.push(c); picked[c.n][r] = true; }
    }
    const raw = tr.map((i) => pick.reduce((s, p) => s + p.v * Z[p.n][i], 0));
    const mu = raw.reduce((a, b) => a + b, 0) / (raw.length || 1), sd = Math.sqrt(raw.reduce((a, b) => a + (b - mu) ** 2, 0) / (raw.length || 1)) || 1;
    const thr = pick.length ? +quant(raw.map((x) => Math.abs((x - mu) / sd)), THR_Q).toFixed(2) : 99;
    return { sel: pick.map((p) => ({ key: p.d.key, fam: p.d.fam, mn: p.d.mn, w: +p.v.toFixed(4), ic: +p.v.toFixed(3), icA: +p.a.toFixed(3), icB: +p.b.toFixed(3) })), sMu: mu, sSd: sd, thr };
  });
  return { norm, reg, ic, stable, picked };
}

/** i-р дээжийн оноо (тухайн горимын моделиор) */
export function scoreAt(f: Pick<Fitted, "norm" | "reg">, fs: FeatureSet, i: number) {
  const R = f.reg[fs.S[i].regime];
  if (!R.sel.length) return { S: 0, thr: R.thr, parts: [] as { key: string; fam: string; mn: string; z: number; w: number; c: number }[] };
  const parts = R.sel.map((x) => { const n = fs.defs.findIndex((d) => d.key === x.key), z = zOf(fs.X[n]?.[i], f.norm[x.key] || [0, 1]); return { key: x.key, fam: x.fam, mn: x.mn, z: +z.toFixed(2), w: x.w, c: x.w * z }; });
  return { S: (parts.reduce((a, p) => a + p.c, 0) - R.sMu) / R.sSd, thr: R.thr, parts };
}

/** Давхцахгүй арилжааны симуляц + чиглэлийн оногдол, IC, хамгийн их уналт */
function evaluate(fs: FeatureSet, idx: number[], score: Map<number, number>, thr: Map<number, number>, recent?: Model["recent"], maxBars = MAX_BARS): Eval {
  const { S, m1 } = fs, y = S.map((s) => s.y);
  const sig = idx.filter((i) => Math.abs(score.get(i)!) >= thr.get(i)! && Number.isFinite(y[i]));
  const hit = sig.length ? sig.filter((i) => Math.sign(y[i]) === Math.sign(score.get(i)!)).length / sig.length : null;
  let trades = 0, tp1 = 0, win = 0, sum = 0, sq = 0, busy = 0, peak = 0, dd = 0;
  for (const i of sig) {
    const s = S[i], dir = Math.sign(score.get(i)!), k = s.m1i + 1;
    if (s.t < busy || k >= m1.length) continue;
    const L = levelsFor(dir, m1[k].o, s), sim = simulate(m1 as Bar[], k, dir, L, maxBars, true);
    if (sim.status === "open") continue;
    const r = sim.r - L.costR;
    trades++; if (sim.tp1) tp1++; if (r > 0) win++; sum += r; sq += r * r; busy = sim.at + 60000;
    peak = Math.max(peak, sum); dd = Math.max(dd, peak - sum);
    recent?.push({ t: s.t, dir, r: +r.toFixed(2), regime: s.regime });
  }
  const mean = trades ? sum / trades : 0, sd = trades > 1 ? Math.sqrt(Math.max(0, sq / trades - mean * mean)) : 0;
  const sc = Float64Array.from(S, (_, i) => score.get(i) ?? NaN);
  return { n: idx.length, ic: idx.length > 50 ? +corr(sc, y, idx).toFixed(3) : null, signals: sig.length, hit: hit === null ? null : +(hit * 100).toFixed(1), trades, tp1, win, exp: trades ? +mean.toFixed(3) : null, se: trades > 1 ? +(sd / Math.sqrt(trades)).toFixed(3) : null, totalR: +sum.toFixed(1), maxDD: +dd.toFixed(1) };
}

/* ── хэлбэлзэл (HAR төрлийн OLS): чиглэлээс ялгаатай нь бодитоор таамаглагддаг ── */
const slot = (t: number) => Math.floor(((t % 864e5) / 864e5) * 48);
const volX = (s: Sample, season: number[]) => [1, Math.log(s.a5), Math.log(Math.max(s.r6, 1e-6)), Math.log(Math.max(s.r24, 1e-6)), season[slot(s.t)]];
function ols(X: number[][], y: number[]): number[] {
  const k = X[0].length, A = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  X.forEach((row, n) => { for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += row[a] * row[b]; A[a][k] += row[a] * y[n]; } });
  for (let a = 0; a < k; a++) A[a][a] += 1e-6;
  for (let i = 0; i < k; i++) {
    let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    for (let r = 0; r < k; r++) { if (r === i) continue; const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; }
  }
  return A.map((row, i) => row[k] / row[i]);
}
function volFit(S: Sample[], idx: number[]) {
  const sum = new Array(48).fill(0), cnt = new Array(48).fill(0);
  for (const i of idx) { const b = slot(S[i].t); sum[b] += Math.log(S[i].rng / S[i].a5); cnt[b]++; }
  const season = sum.map((x, b) => (cnt[b] > 20 ? +(x / cnt[b]).toFixed(4) : 0));
  return { season, beta: ols(idx.map((i) => volX(S[i], season)), idx.map((i) => Math.log(S[i].rng))) };
}
export const volPred = (v: { beta: number[]; season: number[] }, s: Sample) => Math.exp(volX(s, v.season).reduce((a, x, k) => a + x * v.beta[k], 0));
/** Хүрэх магадлалын хүснэгт: P(нэг талын зай ≥ k × таамаг), k = 0.1, 0.2 … 1.5 */
export const TAIL_K = Array.from({ length: 15 }, (_, i) => +(0.1 * (i + 1)).toFixed(1));
function volEval(S: Sample[], fs: FeatureSet): VolModel {
  const idx = S.map((s, i) => (s.rng > 0 && s.up >= 0 && s.dn >= 0 ? i : -1)).filter((i) => i >= 0);
  const t0 = S[idx[0]].t, t1 = S[idx[idx.length - 1]].t, start = t0 + 0.4 * (t1 - t0);
  const pred: number[] = [], act: number[] = [], base: number[] = [], exc: number[] = [];
  for (let cut = start; cut < t1; cut += FOLD) {
    const tr = idx.filter((i) => S[i].t < cut - 45 * 60000), te = idx.filter((i) => S[i].t >= cut && S[i].t < cut + FOLD);
    if (!te.length) continue;
    const f = volFit(S, tr), mB = tr.reduce((a, i) => a + Math.log(S[i].rng), 0) / tr.length;
    for (const i of te) { const p = volPred(f, S[i]); pred.push(Math.log(p)); act.push(Math.log(S[i].rng)); base.push(mB); exc.push(S[i].up / p, S[i].dn / p); }
  }
  const ssr = pred.reduce((a, p, k) => a + (act[k] - p) ** 2, 0), sst = base.reduce((a, b, k) => a + (act[k] - b) ** 2, 0);
  const ae = pred.map((p, k) => Math.abs(Math.exp(act[k] - p) - 1)).sort((a, b) => a - b);
  const ratio = pred.map((p, k) => Math.exp(act[k] - p)).sort((a, b) => a - b), q80 = ratio[Math.floor(ratio.length * 0.8)];
  const live = volFit(S, idx);
  return { ...live, r2: +(1 - ssr / sst).toFixed(3), n: pred.length, mape: +(ae[ae.length >> 1] * 100).toFixed(0), cover80: +q80.toFixed(2),
    tail: TAIL_K.map((k) => +((exc.filter((e) => e >= k).length / exc.length) * 100).toFixed(1)) };
}

export function buildModel(fs: FeatureSet): Model {
  const { S, defs } = fs, valid = S.map((s, i) => (Number.isFinite(s.y) ? i : -1)).filter((i) => i >= 0);
  const t0 = S[valid[0]].t, t1 = S[valid[valid.length - 1]].t, wfFrom = t0 + 0.4 * (t1 - t0);
  /* walk-forward */
  const oS = new Map<number, number>(), oT = new Map<number, number>(), pickCount = defs.map(() => [0, 0] as [number, number]);
  let folds = 0;
  for (let cut = wfFrom; cut < t1; cut += FOLD) {
    const train = valid.filter((i) => S[i].t < cut - 45 * 60000), test = valid.filter((i) => S[i].t >= cut && S[i].t < cut + FOLD);
    if (!test.length) continue;
    const f = fitOn(fs, train);
    f.picked.forEach((p, n) => { if (p[0]) pickCount[n][0]++; if (p[1]) pickCount[n][1]++; });
    for (const i of test) { const s = scoreAt(f, fs, i); oS.set(i, s.S); oT.set(i, s.thr); }
    folds++;
  }
  const oos = [...oS.keys()].sort((a, b) => a - b), recent: Model["recent"] = [];
  const wf = [0, 1].map((r) => evaluate(fs, oos.filter((i) => S[i].regime === r), oS, oT, recent)) as [Eval, Eval];
  /* бодит цагийн модель: бүх дата */
  const live = fitOn(fs, valid);
  const lS = new Map<number, number>(), lT = new Map<number, number>();
  for (const i of valid) { const s = scoreAt(live, fs, i); lS.set(i, s.S); lT.set(i, s.thr); }
  const ins = [0, 1].map((r) => evaluate(fs, valid.filter((i) => S[i].regime === r), lS, lT)) as [Eval, Eval];
  const on = wf.map((e) => e.trades >= 40 && (e.exp ?? 0) > 0.02 && (e.ic ?? 0) > 0) as [boolean, boolean];
  const calib = BINS.slice(0, -1).map((lo, b) => {
    const hi = BINS[b + 1], xs = oos.filter((i) => { const v = oS.get(i)!; return v >= lo && v < hi && Number.isFinite(S[i].y); });
    const up = xs.filter((i) => S[i].y > 0).length;
    return { lo, hi, n: xs.length, pUp: +(((up + 10) / (xs.length + 20)) * 100).toFixed(1) };
  });
  return {
    fittedAt: Date.now(), from: t0, to: t1, samples: valid.length, folds, wfFrom,
    norm: live.norm, reg: live.reg, wf, ins, on, total: defs.length,
    screen: defs.map((d, n) => ({ key: d.key, fam: d.fam, mn: d.mn, ic: live.ic[n], picked: live.picked[n], folds: pickCount[n] })),
    recent: recent.sort((a, b) => b.t - a.t).slice(0, 40), calib, vol: volEval(S, fs),
  };
}
