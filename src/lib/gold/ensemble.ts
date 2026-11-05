import { simulate } from "../scalp/engine";
import { neff } from "../scalp/ind";
import { SCANS, scanAll, scanReady, type ScanCtx, type ScanResult } from "./scans";
import { levelsFor, volFit, volPred, TAIL_K } from "./model";
import type { FeatureSet, Sample } from "./features";

/* ─── Tesla Trader · 5 SCAN дундаж ба хэмжилт (2026-11-05) ───
   Дундаж = 5 онооны энгийн дундаж. Санал нийлэлт = нэг талд ±0.15-аас хүчтэй хэдэн scan байна.
   Дүрэм тогтмол тул 4 сарын бүх дата шалгалт болно; давуу тал гэж хэлэхийн тулд хоёр хагаст
   хоёуланд нь эерэг, ≥40 арилжаа, spread хассан дундаж ≥ +0.02R байх ёстой (FiveReport.on).
   Таван scan нэг үнээс гардаг тул «5 нотолгоо» биш — neff бие даасан дохионы тоог хэмжинэ. */

export const ACTIVE = 0.15;
export function consensus(r: ScanResult[]) {
  const s = r.map((x) => x.score), mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length);
  const up = s.filter((x) => x >= ACTIVE).length, dn = s.filter((x) => x <= -ACTIVE).length;
  const dir = up > dn ? 1 : dn > up ? -1 : Math.abs(mean) >= ACTIVE ? Math.sign(mean) : 0, agree = Math.max(up, dn), against = Math.min(up, dn);
  const label = mean >= 0.4 ? "Хүчтэй өсөх" : mean >= ACTIVE ? "Өсөх" : mean <= -0.4 ? "Хүчтэй унах" : mean <= -ACTIVE ? "Унах" : "Саармаг";
  return { mean: +mean.toFixed(3), sd: +sd.toFixed(3), up, dn, dir, agree, against, label };
}

const corr = (a: number[], b: number[]) => {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; n++; }
  const cv = n * sxy - sx * sy, vx = n * sxx - sx * sx, vy = n * syy - sy * sy;
  return n > 30 && vx > 0 && vy > 0 ? cv / Math.sqrt(vx * vy) : 0;
};
const BINS = [-1.01, -0.4, -0.25, -0.1, 0.1, 0.25, 0.4, 1.01];
export type ScanStat = { id: string; mn: string; active: number; hit: number; ic: number; h1: number; h2: number };
export type RuleStat = { k: number; n: number; hit: number; trades: number; tp1: number; exp: number | null; se: number | null; h1: number | null; h2: number | null; totalR: number; on: boolean };
export type FiveReport = {
  fittedAt: number; from: number; to: number; n: number; base: number; scans: ScanStat[]; mean: ScanStat; rules: RuleStat[]; corr: number[][]; neff: number;
  calib: { lo: number; hi: number; n: number; pUp: number }[]; on: boolean; onK: number;
};

export async function measure(fs: FeatureSet, c: ScanCtx): Promise<FiveReport> {
  const jOf = new Map(c.T.map((t, j) => [t, j]));
  const idx: number[] = [], Y: number[] = [], sc: number[][] = SCANS.map(() => []), mean: number[] = [], agree: number[] = [], dirs: number[] = [];
  let tick = 0;
  for (let i = 0; i < fs.S.length; i++) {
    const s = fs.S[i], j = jOf.get(s.t);
    if (j === undefined || !Number.isFinite(s.y) || !scanReady(c, j)) continue;
    const r = scanAll(c, j), con = consensus(r);
    idx.push(i); Y.push(s.y); r.forEach((x, k) => sc[k].push(x.score)); mean.push(con.mean); agree.push(con.agree); dirs.push(con.dir);
    if (++tick % 400 === 0) await new Promise((res) => setImmediate(res));
  }
  const half = idx.length >> 1;
  const stat = (id: string, mn: string, v: number[], act = ACTIVE): ScanStat => {
    const pick = (a: number, b: number) => { let w = 0, n = 0; for (let i = a; i < b; i++) { if (Math.abs(v[i]) < act || !Y[i]) continue; n++; if (Math.sign(v[i]) === Math.sign(Y[i])) w++; } return { w, n }; };
    const all = pick(0, v.length), A = pick(0, half), B = pick(half, v.length), r = (x: { w: number; n: number }) => (x.n ? +((x.w / x.n) * 100).toFixed(1) : 0);
    return { id, mn, active: Math.round((all.n / v.length) * 100), hit: r(all), ic: +corr(v, Y).toFixed(3), h1: r(A), h2: r(B) };
  };
  const scans = SCANS.map((x, k) => stat(x.id, x.mn, sc[k]));
  const { S } = fs;
  const rules: RuleStat[] = [];
  for (const k of [2, 3, 4, 5]) {
    let w = 0, n = 0, trades = 0, tp1 = 0, sum = 0, sq = 0, busy = 0, s1 = 0, n1 = 0, s2 = 0, n2 = 0;
    const mid = S[idx[half]]?.t ?? 0;
    for (let q = 0; q < idx.length; q++) {
      if (agree[q] < k || !dirs[q]) continue;
      n++; if (Y[q] && Math.sign(Y[q]) === dirs[q]) w++;
      const s = S[idx[q]], at = s.m1i + 1;
      if (s.t < busy || at >= fs.m1.length) continue;
      const L = levelsFor(dirs[q], fs.m1[at].o, s), sim = simulate(fs.m1, at, dirs[q], L, 45, true);
      if (sim.status === "open") continue;
      const r = sim.r - L.costR;
      trades++; if (sim.tp1) tp1++; sum += r; sq += r * r; busy = sim.at + 60000;
      if (s.t < mid) { s1 += r; n1++; } else { s2 += r; n2++; }
    }
    const m = trades ? sum / trades : 0, sd = trades > 1 ? Math.sqrt(Math.max(0, sq / trades - m * m)) : 0;
    const h1 = n1 ? +(s1 / n1).toFixed(3) : null, h2 = n2 ? +(s2 / n2).toFixed(3) : null;
    rules.push({ k, n, hit: n ? +((w / n) * 100).toFixed(1) : 0, trades, tp1, exp: trades ? +m.toFixed(3) : null, se: trades > 1 ? +(sd / Math.sqrt(trades)).toFixed(3) : null, h1, h2, totalR: +sum.toFixed(1), on: trades >= 40 && m >= 0.02 && (h1 ?? 0) > 0 && (h2 ?? 0) > 0 });
  }
  const best = [...rules].reverse().find((r) => r.on);
  return {
    fittedAt: Date.now(), from: S[idx[0]]?.t ?? 0, to: S[idx[idx.length - 1]]?.t ?? 0, n: idx.length,
    base: +((Y.filter((y) => y > 0).length / Y.length) * 100).toFixed(1), scans, mean: stat("mean", "5 scan дундаж", mean), rules,
    corr: sc.map((a) => sc.map((b) => +corr(a, b).toFixed(2))), neff: +neff(sc.map((a) => a.filter((_, i) => i % 3 === 0))).toFixed(2),
    calib: BINS.slice(0, -1).map((lo, b) => {
      const hi = BINS[b + 1]; let n = 0, u = 0;
      mean.forEach((m, i) => { if (m >= lo && m < hi) { n++; if (Y[i] > 0) u++; } });
      return { lo, hi, n, pUp: +(((u + 10) / (n + 20)) * 100).toFixed(1) };
    }),
    on: !!best, onK: best?.k ?? 0,
  };
}

/* ── хүрээний 5 таамаг: scan бүр нэг эх үүсвэртэй, сүүлд нь нарийвчлалаар жигнэж дундажлана ──
   Жин ∝ 1/MSE² (Bates–Granger) — зөвхөн өмнөх датаар. Чиглэлээс ялгаатай нь хэлбэлзэл таамаглагддаг тул
   энд олон таамаг нэгтгэх нь утгатай. Өдрийн цагийн улирал HAR-аас бусад дөрөвт ижил засвар болж орно. */
export const RANGE_SRC = ["ATR (M5)", "2 цагийн хүрээ", "HAR + өдрийн цаг", "Garman-Klass", "ATR (H1)"];
const FOLD = 14 * 864e5;
const slot = (t: number) => Math.floor(((t % 864e5) / 864e5) * 48);
type Fit = { b: number[]; season: number[]; har: { beta: number[]; season: number[] }; w: number[] };
export type RangeModel = Fit & { r2: number[]; ape: number[]; r2Eq: number; apeEq: number; r2W: number; apeW: number; band80: number; tail: number[]; n: number };
function rawOf(c: ScanCtx, s: Pick<Sample, "a5" | "r24" | "c">, j: number) {
  let gk = 0;
  for (let q = j - 11; q <= j; q++) { const b = c.m5[q]; gk += 0.5 * Math.log(b.h / b.l) ** 2 - (2 * Math.LN2 - 1) * Math.log(b.c / b.o) ** 2; }
  return [s.a5, s.r24 / 2, 0, Math.sqrt(Math.max(1e-12, gk / 12)) * s.c, c.ah[c.h[j]]];
}
export function rangePreds(f: Fit, c: ScanCtx, s: Sample, j: number) {
  const r = rawOf(c, s, j), sl = f.season[slot(s.t)] - f.b[0];
  return r.map((x, k) => (k === 2 ? Math.log(volPred(f.har, s)) : Math.log(x) + f.b[k] + sl));
}
export const weighted = (f: Pick<Fit, "w">, p: number[]) => p.reduce((a, x, k) => a + x * f.w[k], 0);
function fitRange(S: Sample[], c: ScanCtx, jOf: Map<number, number>, idx: number[]): Fit {
  const b = [0, 0, 0, 0, 0], sum = new Array(48).fill(0), cnt = new Array(48).fill(0), raws = idx.map((i) => rawOf(c, S[i], jOf.get(S[i].t)!));
  idx.forEach((i, n) => { const y = Math.log(S[i].rng); raws[n].forEach((x, k) => { if (k !== 2) b[k] += y - Math.log(x); }); const sl = slot(S[i].t); sum[sl] += y - Math.log(raws[n][0]); cnt[sl]++; });
  const B = b.map((x) => x / idx.length), season = sum.map((x, s) => (cnt[s] > 20 ? +(x / cnt[s]).toFixed(4) : B[0])), har = volFit(S, idx);
  const f: Fit = { b: B, season, har, w: [0.2, 0.2, 0.2, 0.2, 0.2] }, mse = [0, 0, 0, 0, 0];
  for (const i of idx) { const y = Math.log(S[i].rng); rangePreds(f, c, S[i], jOf.get(S[i].t)!).forEach((p, k) => { mse[k] += (y - p) ** 2; }); }
  const inv = mse.map((e) => 1 / (e * e)), tot = inv.reduce((a, x) => a + x, 0);
  f.w = inv.map((x) => +(x / tot).toFixed(4));
  return f;
}
export function rangeModel(fs: FeatureSet, c: ScanCtx): RangeModel {
  const { S } = fs, jOf = new Map(c.T.map((t, j) => [t, j]));
  const idx = S.map((s, i) => { const j = jOf.get(s.t); return s.rng > 0 && j !== undefined && scanReady(c, j) ? i : -1; }).filter((i) => i >= 0);
  const t0 = S[idx[0]].t, t1 = S[idx[idx.length - 1]].t, rows: { p: number[]; w: number; act: number; base: number; mv: number; up: number; dn: number }[] = [];
  for (let cut = t0 + 0.4 * (t1 - t0); cut < t1; cut += FOLD) {
    const tr = idx.filter((i) => S[i].t < cut - 45 * 60000), te = idx.filter((i) => S[i].t >= cut && S[i].t < cut + FOLD);
    if (!te.length) continue;
    const f = fitRange(S, c, jOf, tr), base = tr.reduce((a, i) => a + Math.log(S[i].rng), 0) / tr.length;
    for (const i of te) {
      const s = S[i], p = rangePreds(f, c, s, jOf.get(s.t)!), w = weighted(f, p), pred = Math.exp(w);
      rows.push({ p, w, act: Math.log(s.rng), base, mv: Number.isFinite(s.y) ? Math.abs(s.y * s.a5) / pred : NaN, up: s.up / pred, dn: s.dn / pred });
    }
  }
  const ev = (g: (r: (typeof rows)[number]) => number) => {
    let ssr = 0, sst = 0; const ape: number[] = [];
    for (const r of rows) { const e = r.act - g(r); ssr += e * e; sst += (r.act - r.base) ** 2; ape.push(Math.abs(Math.exp(e) - 1)); }
    ape.sort((a, b) => a - b);
    return { r2: +(1 - ssr / sst).toFixed(3), ape: +(ape[ape.length >> 1] * 100).toFixed(1) };
  };
  const each = RANGE_SRC.map((_, k) => ev((r) => r.p[k])), eq = ev((r) => r.p.reduce((a, x) => a + x, 0) / 5), wt = ev((r) => r.w);
  const mv = rows.map((r) => r.mv).filter(Number.isFinite).sort((a, b) => a - b), exc = rows.flatMap((r) => [r.up, r.dn]);
  return {
    ...fitRange(S, c, jOf, idx), r2: each.map((x) => x.r2), ape: each.map((x) => x.ape), r2Eq: eq.r2, apeEq: eq.ape, r2W: wt.r2, apeW: wt.ape,
    band80: +mv[Math.floor(mv.length * 0.8)].toFixed(3), tail: TAIL_K.map((k) => +((exc.filter((e) => e >= k).length / exc.length) * 100).toFixed(1)), n: rows.length,
  };
}
