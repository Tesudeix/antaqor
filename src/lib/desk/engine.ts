import { type Bar, ema, sma, atr, rsi, adx, boll, stoch, mfi, macd, supertrend } from "../scalp/ind";
import type { TF } from "./market";

/* ─── Tesla Trader · Шинжилгээний ширээ — хөдөлгүүр (2026-11-06) ───
   Хугацаа бүрт: swing бүтэц (HH/HL/LH/LL/EQ), BOS, liquidity sweep, загвар, индикатор, нөхцөлт төлөвлөгөө.
   Төлөвлөгөө бол «одоо ор» гэсэн дохио биш: хаана хүлээх, юугаар батлах, хаана хүчингүй болох.
   Бүх функц i-р ХААГДСАН лаа хүртэлх датаг л хардаг — бодит цаг ба хэмжилт НЭГ код, тохируулаагүй тогтмол дүрэм. */

export type Swing = { i: number; p: number; hi: boolean; label: string };
export type Ctx = ReturnType<typeof ctxOf>;
const K = 3;

function pivots(b: Bar[]) {
  const out: { i: number; p: number; hi: boolean }[] = [];
  for (let i = K; i < b.length - K; i++) {
    let hi = true, lo = true;
    for (let q = i - K; q <= i + K; q++) { if (b[q].h > b[i].h) hi = false; if (b[q].l < b[i].l) lo = false; }
    if (hi) out.push({ i, p: b[i].h, hi: true });
    if (lo) out.push({ i, p: b[i].l, hi: false });
  }
  return out;
}
export function ctxOf(bars: Bar[], tf: TF, cost: (p: number) => number, emaN = 9, rsiN = 14) {
  const c = bars.map((b) => b.c);
  return { tf, bars, c, cost, emaN, rsiN, a: atr(bars, 14), e: ema(c, emaN), r: rsi(c, rsiN), piv: pivots(bars) };
}
export const ctxReady = (x: Ctx, i: number) => i >= 40 && x.a[i] > 0;

/** i хүртэл баталгаажсан, ≥0.75 ATR-ийн хөлтэй ээлжилсэн swing + шошго */
export function swingsAt(x: Ctx, i: number, n = 9): Swing[] {
  let lo = 0, hi = x.piv.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (x.piv[m].i + K <= i) lo = m + 1; else hi = m; }
  const z: { i: number; p: number; hi: boolean }[] = [];
  for (let q = Math.max(0, lo - 60); q < lo; q++) {
    const c = x.piv[q], last = z[z.length - 1];
    if (!last) z.push(c);
    else if (last.hi === c.hi) { if (c.hi ? c.p >= last.p : c.p <= last.p) z[z.length - 1] = c; }
    else if (Math.abs(c.p - last.p) >= 0.75 * (x.a[c.i] || 0)) z.push(c);
  }
  let ph = NaN, pl = NaN;
  const out = z.map((s) => {
    const tol = 0.15 * (x.a[s.i] || 0), prev = s.hi ? ph : pl;
    const label = Number.isNaN(prev) ? (s.hi ? "H" : "L") : Math.abs(s.p - prev) <= tol ? (s.hi ? "EQH" : "EQL") : s.hi ? (s.p > prev ? "HH" : "LH") : s.p > prev ? "HL" : "LL";
    if (s.hi) ph = s.p; else pl = s.p;
    return { ...s, label };
  });
  return out.slice(-n);
}

export function structureAt(x: Ctx, i: number) {
  const z = swingsAt(x, i), b = x.bars, c = b[i].c, a = x.a[i];
  const highs = z.filter((s) => s.hi), lows = z.filter((s) => !s.hi), H = highs[highs.length - 1], L = lows[lows.length - 1], H0 = highs[highs.length - 2], L0 = lows[lows.length - 2];
  const dir = H && L && H0 && L0 ? (H.p > H0.p && L.p > L0.p ? 1 : H.p < H0.p && L.p < L0.p ? -1 : 0) : 0;
  const bos = L && c < L.p - 0.1 * a ? -1 : H && c > H.p + 0.1 * a ? 1 : 0;
  /* sweep: сүүлийн 10 лаанд swing-ийг сүүдрээр цоолоод эргэж хаагдсан, түүнээс хойш хаалт давж гараагүй */
  let sweep: null | { dir: number; level: number; wick: number; t: number; label: string } = null;
  for (let t = i; t >= Math.max(i - 9, 1) && !sweep; t--) {
    for (const s of [...z].reverse()) {
      if (s.i >= t) continue;
      if (s.hi && b[t].h > s.p && b[t].c < s.p) { let ok = true; for (let q = t + 1; q <= i; q++) if (b[q].c > s.p) ok = false; if (ok) { sweep = { dir: -1, level: s.p, wick: b[t].h, t: b[t].t, label: s.label }; break; } }
      if (!s.hi && b[t].l < s.p && b[t].c > s.p) { let ok = true; for (let q = t + 1; q <= i; q++) if (b[q].c < s.p) ok = false; if (ok) { sweep = { dir: 1, level: s.p, wick: b[t].l, t: b[t].t, label: s.label }; break; } }
    }
  }
  const emaSide = Math.sign(c - x.e[i]) || 0;
  let rMin = 100, rMax = 0;
  for (let t = Math.max(0, i - 12); t <= i; t++) { if (x.r[t] < rMin) rMin = x.r[t]; if (x.r[t] > rMax) rMax = x.r[t]; }
  return { z, H, L, dir, bos, sweep, emaSide, score: dir + bos + 0.5 * emaSide, c, a, ema: x.e[i], rsi: x.r[i], rMin, rMax };
}
export type Structure = ReturnType<typeof structureAt>;

/* ── графикийн загвар: сүүлийн swing-ээс, төлөвтэй (хэлбэржиж буй / баталгаажсан / сул дорой) ── */
export type Pattern = { name: string; dir: number; status: "forming" | "active" | "failed"; neck: number; pts: { t: number; p: number }[] } | null;
export function patternAt(x: Ctx, i: number, z: Swing[]): Pattern {
  const a = x.a[i], c = x.c[i], b = x.bars, L = z.length;
  if (L < 3) return null;
  const closesPast = (from: number, lvl: number, up: boolean) => { for (let q = from; q <= i; q++) if (up ? x.c[q] > lvl : x.c[q] < lvl) return true; return false; };
  const pts = (s: Swing[]) => s.map((q) => ({ t: b[q.i].t, p: q.p }));
  for (let e = L - 1; e >= Math.max(2, L - 3); e--) {
    const [p, m, q] = [z[e - 2], z[e - 1], z[e]];
    if (p.hi !== q.hi || m.hi === q.hi || Math.abs(p.p - q.p) > 0.6 * a) continue;
    const up = !q.hi, neck = m.p, broke = closesPast(q.i + 1, neck, up);
    const status = up ? (c > neck ? "active" : broke ? "failed" : "forming") : c < neck ? "active" : broke ? "failed" : "forming";
    if (up ? c < Math.min(p.p, q.p) - 0.5 * a : c > Math.max(p.p, q.p) + 0.5 * a) continue;
    return { name: up ? "Давхар ёроол" : "Давхар оргил", dir: up ? 1 : -1, status, neck, pts: pts([p, m, q]) };
  }
  if (L >= 5) {
    const [s1, n1, h, n2, s2] = z.slice(-5);
    if (s1.hi && s2.hi && h.hi && h.p > Math.max(s1.p, s2.p) + 0.5 * a && Math.abs(s1.p - s2.p) <= 1.2 * a) { const neck = Math.min(n1.p, n2.p); return { name: "Толгой-мөр", dir: -1, status: c < neck ? "active" : "forming", neck, pts: pts([s1, n1, h, n2, s2]) }; }
    if (!s1.hi && !s2.hi && !h.hi && h.p < Math.min(s1.p, s2.p) - 0.5 * a && Math.abs(s1.p - s2.p) <= 1.2 * a) { const neck = Math.max(n1.p, n2.p); return { name: "Урвуу толгой-мөр", dir: 1, status: c > neck ? "active" : "forming", neck, pts: pts([s1, n1, h, n2, s2]) }; }
  }
  return null;
}

/* ── стратеги: нөхцөлт төлөвлөгөө ── */
export const STRATS = {
  pullback: { mn: "Трендийн буцалт", en: "Pullback Retracement", sub: "Импульсийн дараах буцалтаас EMA-ийн чиглэлд, RSI-ээр батална" },
  sweep: { mn: "Liquidity Sweep", en: "Liquidity Sweep", sub: "Swing-ийг шүүрдээд эргэж хаагдахад эсрэг чиглэлд" },
  smc: { mn: "SMC · Order block", en: "SMC", sub: "BOS-ийн дараа order block эсвэл FVG руу буцахад" },
};
export type Strat = keyof typeof STRATS;
export type Plan = { strat: Strat; dir: number; lo: number; hi: number; entry: number; sl: number; tp1: number; tp2: number; rr: number; rr2: number; rsiConfirm: boolean; live: boolean; basis: string };
export type NoPlan = { none: string };

function nextBeyond(z: Swing[], from: number, dir: number, ext: number) {
  const c = z.filter((s) => s.hi === dir > 0 && (dir > 0 ? s.p > from : s.p < from)).map((s) => s.p).sort((p, q) => (dir > 0 ? p - q : q - p));
  return c[0] ?? from + dir * ext;
}
/** Эхний зорилт: орох цэгээс ≥1R цаашх хамгийн ойрын swing, үгүй бол 2R */
function firstTarget(z: Swing[], entry: number, risk: number, dir: number) {
  return nextBeyond(z, entry + dir * risk, dir, risk);
}
function finish(st: Structure, strat: Strat, dir: number, near: number, far: number, sl: number, tp1: number, tp2: number, rsiConfirm: boolean, basis: string): Plan | NoPlan {
  const risk = (near - sl) * dir, gain = (tp1 - near) * dir;
  if (risk < 0.3 * st.a) return { none: "SL хэт ойр — шуугиан гаргана" };
  if (gain <= 0) return { none: "Зорилтот түвшин орох цэгийн буруу талд байна" };
  return { strat, dir, lo: Math.min(near, far), hi: Math.max(near, far), entry: near, sl, tp1, tp2, rr: +(gain / risk).toFixed(2), rr2: +(((tp2 - near) * dir) / risk).toFixed(2), rsiConfirm, live: (st.c - near) * dir <= 0 && (st.c - far) * dir >= 0, basis };
}
export function planAt(x: Ctx, i: number, st: Structure, strat: Strat): Plan | NoPlan {
  const b = x.bars, a = st.a, z = st.z, H = st.H, L = st.L;
  if (!H || !L) return { none: "Swing хангалтгүй" };
  if (strat === "pullback") {
    const d = st.score >= 0.5 ? 1 : st.score <= -0.5 ? -1 : 0;
    if (!d) return { none: "Чиглэл тодорхойгүй — буцалтын стратеги ажиллахгүй" };
    const A = d < 0 ? H : L;
    let B = d < 0 ? Infinity : -Infinity;
    for (let t = A.i; t <= i; t++) B = d < 0 ? Math.min(B, b[t].l) : Math.max(B, b[t].h);
    const size = Math.abs(A.p - B);
    if (size < 2 * a) return { none: "Импульс 2 ATR-аас бага" };
    const lvl = (f: number) => B - d * f * size, r236 = lvl(0.236), r382 = lvl(0.382), r618 = lvl(0.618);
    const broken = z.filter((s) => s.hi === (d > 0) && (s.p - r236) * d <= 0 && (s.p - r618) * d >= 0 && (st.c - s.p) * d > 0).map((s) => s.p).sort((p, q) => (q - p) * d)[0];
    const near = broken ?? r382;
    let far = r618;
    if (Math.abs(far - near) < 0.3 * a) far = near - d * 0.3 * a;
    if ((st.c - far) * d < 0) return { none: "Үнэ буцалтын бүсийг давчихсан" };
    const slFar = far - d * 0.75 * a, slA = A.p - d * 0.25 * a, sl = d < 0 ? Math.min(slFar, Math.max(slA, far + 0.25 * a)) : Math.max(slFar, Math.min(slA, far - 0.25 * a));
    return finish(st, strat, d, near, far, sl, B, nextBeyond(z, B, d, 0.272 * size), true, broken !== undefined ? "Эвдэрсэн түвшин" : "Фибоначчи 38–62%");
  }
  if (strat === "sweep") {
    if (st.sweep) {
      const w = st.sweep, d = w.dir, sl = w.wick - d * 0.25 * a, tp1 = firstTarget(z, w.level, Math.abs(w.level - sl), d);
      return finish(st, strat, d, w.level, w.wick, sl, tp1, nextBeyond(z, tp1, d, 2 * a), false, `${w.label} шүүрдэгдсэн`);
    }
    const d = st.score >= 1 ? 1 : st.score <= -1 ? -1 : Math.abs(st.c - H.p) < Math.abs(st.c - L.p) ? -1 : 1;
    const S = d > 0 ? L.p : H.p, tp1 = firstTarget(z, S, a, d);
    if (Math.abs(st.c - S) > 6 * a) return { none: "Хөрвөх чадварын түвшин үнээс хэт хол" };
    return finish(st, strat, d, S, S - d * 0.5 * a, S - d * a, tp1, nextBeyond(z, tp1, d, 2 * a), false, `${d > 0 ? L.label : H.label} дээрх хөрвөх чадвар`);
  }
  let d = 0;
  for (let t = i; t >= Math.max(i - 30, 1) && !d; t--) { const hs = z.filter((s) => s.i < t); const h = hs.filter((s) => s.hi).pop(), l = hs.filter((s) => !s.hi).pop(); if (h && x.c[t] > h.p && x.c[t - 1] <= h.p) d = 1; else if (l && x.c[t] < l.p && x.c[t - 1] >= l.p) d = -1; }
  if (!d) return { none: "Сүүлийн 30 лаанд BOS алга" };
  for (let t = i - 3; t >= Math.max(1, i - 40); t--) {
    const move = x.c[t + 3] - b[t + 1].o, opp = (b[t].c - b[t].o) * d < 0;
    if (!opp || move * d < 1.5 * x.a[t]) continue;
    const near = d > 0 ? b[t].h : b[t].l, far = d > 0 ? b[t].l : b[t].h;
    let hit = false;
    for (let q = t + 4; q <= i; q++) if ((x.c[q] - far) * d < 0) hit = true;
    if (hit || (st.c - near) * d < 0 || Math.abs(st.c - near) > 6 * a) continue;
    const sl = far - d * 0.25 * a, tp1 = firstTarget(z, near, Math.abs(near - sl), d);
    return finish(st, strat, d, near, far, sl, tp1, nextBeyond(z, tp1, d, 2 * a), false, "Order block");
  }
  return { none: "Хадгалагдсан order block алга" };
}

/* ── нэг төлөвлөгөөг дараах лаануудаар дагах ── */
export function follow(x: Ctx, i: number, p: Plan, W = 40, H = 60) {
  const b = x.bars, n = b.length, d = p.dir, far = d > 0 ? p.lo : p.hi;
  let touched = false;
  for (let t = i + 1; t < n && t <= i + W; t++) {
    const k = b[t];
    if ((k.c - far) * d < 0) return { fired: false, end: "cancel", exit: t, r: 0 };
    if (!touched && (d > 0 ? k.h >= p.tp1 : k.l <= p.tp1)) return { fired: false, end: "missed", exit: t, r: 0 };
    if (d > 0 ? k.l <= p.entry : k.h >= p.entry) touched = true;
    const back = (k.c - p.entry) * d > 0, rsiOk = !p.rsiConfirm || (x.r[t] - x.r[t - 1]) * d > 0;
    if (!touched || !back || !rsiOk) continue;
    const e = k.c, risk = (e - p.sl) * d, cost = x.cost(e) / (risk || 1);
    if (risk <= 0 || (p.tp1 - e) * d <= 0) return { fired: false, end: "cancel", exit: t, r: 0 };
    for (let q = t + 1; q < n && q <= t + H; q++) {
      const m = b[q];
      if (d > 0 ? m.l <= p.sl : m.h >= p.sl) return { fired: true, end: "sl", exit: q, r: -1 - cost };
      if (d > 0 ? m.h >= p.tp1 : m.l <= p.tp1) return { fired: true, end: "tp", exit: q, r: ((p.tp1 - e) * d) / risk - cost };
    }
    const q = Math.min(n - 1, t + H);
    return { fired: true, end: q - t < H ? "open" : "time", exit: q, r: ((b[q].c - e) * d) / risk - cost };
  }
  return { fired: false, end: "expired", exit: Math.min(n - 1, i + W), r: 0 };
}

export type Stat = { plans: number; fired: number; tp: number; sl: number; exp: number | null; se: number | null; h1: number | null; h2: number | null; from: number; to: number };
export async function measure(x: Ctx, strat: Strat): Promise<Stat> {
  const n = x.bars.length, rs: { r: number; tp: boolean; sl: boolean }[] = [];
  let plans = 0, i = 60, tick = 0;
  while (i < n - 45) {
    if (++tick % 300 === 0) await new Promise((res) => setImmediate(res));
    if (!ctxReady(x, i)) { i++; continue; }
    const st = structureAt(x, i), p = planAt(x, i, st, strat);
    if ("none" in p || p.rr < 1) { i++; continue; }
    plans++;
    const f = follow(x, i, p);
    if (f.fired && f.end !== "open") rs.push({ r: f.r, tp: f.end === "tp", sl: f.end === "sl" });
    i = f.exit + 1;
  }
  const m = rs.length ? rs.reduce((a, q) => a + q.r, 0) / rs.length : 0, sd = rs.length > 1 ? Math.sqrt(rs.reduce((a, q) => a + (q.r - m) ** 2, 0) / rs.length) : 0;
  const half = rs.length >> 1, avg = (a: typeof rs) => (a.length ? +(a.reduce((s, q) => s + q.r, 0) / a.length).toFixed(3) : null);
  return { plans, fired: rs.length, tp: rs.filter((q) => q.tp).length, sl: rs.filter((q) => q.sl).length, exp: rs.length ? +m.toFixed(3) : null, se: rs.length > 1 ? +(sd / Math.sqrt(rs.length)).toFixed(3) : null, h1: avg(rs.slice(0, half)), h2: avg(rs.slice(half)), from: x.bars[0]?.t ?? 0, to: x.bars[n - 1]?.t ?? 0 };
}

/* ── чарт дээр зурах зүйлс: шошго, BOS/CHoCH, шүүрдэлт, rejection, трендийн шугам, таамгийн зам ── */
export type Mark = { t: number; above: boolean; text: string; kind: "up" | "dn" | "warn" | "mute" };
export type Trend = { name: string; a: { t: number; p: number }; b: { t: number; p: number }; end: { t: number; p: number } };
export type Draw = { marks: Mark[]; trends: Trend[]; path: { t: number; p: number }[]; alt: { t: number; p: number }[]; step: number; future: number; neck: { p: number; name: string } | null };
export function drawAt(x: Ctx, i: number, st: Structure, plan: Plan | null, pat: Pattern): Draw {
  const b = x.bars, z = st.z, a = st.a, marks: Mark[] = [];
  /* амралтын завсар алхмыг томруулахгүй — сүүлийн зайнуудаас хамгийн богино */
  const step = Math.min(...[0, 1, 2, 3, 4].map((k) => b[i - k].t - b[i - k - 1].t));
  for (const s of z.slice(-6)) marks.push({ t: b[s.i].t, above: s.hi, text: s.label, kind: /^(HH|HL)$/.test(s.label) ? "up" : /^(LH|LL)$/.test(s.label) ? "dn" : "mute" });
  /* BOS: swing-ийг хаалтаар анх давсан лаа; өмнөх эвдрэлийн эсрэг бол CHoCH */
  const brk: { t: number; dir: number }[] = [];
  for (const s of z) for (let t = s.i + K; t <= i; t++) { if (s.hi ? b[t].c > s.p : b[t].c < s.p) { brk.push({ t, dir: s.hi ? 1 : -1 }); break; } }
  brk.sort((p, q) => p.t - q.t);
  brk.forEach((k, n) => { if (n >= brk.length - 2) marks.push({ t: b[k.t].t, above: k.dir < 0, text: n > 0 && brk[n - 1].dir !== k.dir ? "CHoCH" : "BOS", kind: k.dir > 0 ? "up" : "dn" }); });
  let sw = 0;
  for (let t = i; t >= Math.max(i - 40, 1) && sw < 2; t--) for (const s of [...z].reverse()) {
    if (s.i >= t) continue;
    if (s.hi ? b[t].h > s.p && b[t].c < s.p : b[t].l < s.p && b[t].c > s.p) { marks.push({ t: b[t].t, above: s.hi, text: `${s.label} · Sweep`, kind: "warn" }); sw++; break; }
  }
  for (let t = i; t >= Math.max(i - 8, 1); t--) {
    const k = b[t], r = k.h - k.l, body = Math.abs(k.c - k.o), up = k.h - Math.max(k.o, k.c), lo = Math.min(k.o, k.c) - k.l;
    if (r < 0.6 * a) continue;
    if (up >= 2 * body && up >= 0.55 * r) { marks.push({ t: k.t, above: true, text: "Rejection", kind: "dn" }); break; }
    if (lo >= 2 * body && lo >= 0.55 * r) { marks.push({ t: k.t, above: false, text: "Rejection", kind: "up" }); break; }
  }
  const trends: Trend[] = [], line = (s: Swing[], name: string) => {
    if (s.length < 2) return;
    const [p, q] = s.slice(-2), m = (q.p - p.p) / (q.i - p.i || 1);
    trends.push({ name, a: { t: b[p.i].t, p: p.p }, b: { t: b[q.i].t, p: q.p }, end: { t: b[i].t, p: q.p + m * (i - q.i) } });
  };
  const hs = z.filter((s) => s.hi), ls = z.filter((s) => !s.hi);
  line(hs, hs.length > 1 && hs[hs.length - 1].p < hs[hs.length - 2].p ? "Уруудах эсэргүүцэл" : "Өгсөх эсэргүүцэл");
  line(ls, ls.length > 1 && ls[ls.length - 1].p < ls[ls.length - 2].p ? "Доод ёроолын дэмжлэг" : "Өгсөх дэмжлэг");
  const path: Draw["path"] = [], alt: Draw["alt"] = [];
  let future = 12;
  if (plan) {
    const pace = 0.5 * a, n1 = Math.max(2, Math.min(14, Math.ceil(Math.abs(st.c - plan.entry) / pace))), n2 = Math.max(3, Math.min(26, Math.ceil(Math.abs(plan.tp1 - plan.entry) / pace))), n3 = Math.max(2, Math.min(10, Math.ceil(Math.abs(plan.sl - plan.entry) / pace)));
    const t0 = b[i].t + step;
    path.push({ t: t0, p: st.c }, { t: t0 + n1 * step, p: plan.entry }, { t: t0 + (n1 + n2) * step, p: plan.tp1 });
    alt.push({ t: t0 + n1 * step, p: plan.entry }, { t: t0 + (n1 + n3) * step, p: plan.sl });
    future = n1 + Math.max(n2, n3) + 8;
  }
  return { marks: marks.sort((p, q) => p.t - q.t), trends, path, alt, step, future, neck: pat ? { p: pat.neck, name: pat.name } : null };
}

/* ── индикатор: нэр, тохиргоо, чартын шугам, текст уншилт, санал ── */
function psar(b: Bar[], step = 0.02, max = 0.2) {
  const line: number[] = new Array(b.length).fill(NaN);
  if (b.length < 3) return line;
  let up = b[1].c >= b[0].c, sar = up ? b[0].l : b[0].h, ep = up ? b[1].h : b[1].l, af = step;
  for (let i = 2; i < b.length; i++) {
    sar += af * (ep - sar);
    sar = up ? Math.min(sar, b[i - 1].l, b[i - 2].l) : Math.max(sar, b[i - 1].h, b[i - 2].h);
    if (up ? b[i].l < sar : b[i].h > sar) { up = !up; sar = ep; ep = up ? b[i].h : b[i].l; af = step; }
    else if (up ? b[i].h > ep : b[i].l < ep) { ep = up ? b[i].h : b[i].l; af = Math.min(max, af + step); }
    line[i] = sar;
  }
  return line;
}
const rocP = (c: number[], n: number) => c.map((x, i) => (i < n ? 0 : (100 * (x - c[i - n])) / c[i - n]));
const mid = (b: Bar[], i: number, n: number) => { let h = -Infinity, l = Infinity; for (let k = Math.max(0, i - n + 1); k <= i; k++) { h = Math.max(h, b[k].h); l = Math.min(l, b[k].l); } return (h + l) / 2; };
export const INDICATORS = [
  { id: "ema", mn: "EMA", p: 9 }, { id: "sma", mn: "SMA", p: 20 }, { id: "rsi", mn: "RSI", p: 14 }, { id: "macd", mn: "MACD", p: 0 }, { id: "bb", mn: "Bollinger Bands", p: 20 }, { id: "atr", mn: "ATR", p: 14 },
  { id: "adx", mn: "ADX", p: 14 }, { id: "stoch", mn: "Stochastic", p: 14 }, { id: "ichi", mn: "Ichimoku", p: 0 }, { id: "vwap", mn: "VWAP", p: 0 }, { id: "sar", mn: "SAR", p: 0 }, { id: "st", mn: "Supertrend", p: 10 },
  { id: "kst", mn: "KST", p: 0 }, { id: "pctb", mn: "Percent B", p: 20 }, { id: "mfi", mn: "MFI", p: 14 }, { id: "dpo", mn: "DPO", p: 20 }, { id: "rvol", mn: "Relative Volume", p: 20 }, { id: "ad", mn: "Accumulation/Distribution", p: 0 },
];
export type IndLine = { name: string; v: number[]; dots?: boolean };
export type IndOut = { id: string; label: string; pane: "price" | "sub"; lines: IndLine[]; read: (i: number) => string; ref?: number[]; vote: (i: number) => number };
export function indicator(id: string, p0: number | undefined, b: Bar[], digits: number): IndOut | null {
  const def = INDICATORS.find((x) => x.id === id);
  if (!def) return null;
  const p = Math.max(2, Math.min(400, Math.round(p0 || def.p || 14))), c = b.map((x) => x.c), f = (x: number, d = digits) => (Number.isFinite(x) ? x.toFixed(d) : "—");
  switch (id) {
    case "ema": case "sma": { const v = id === "ema" ? ema(c, p) : sma(c, p); return { id, label: `${def.mn}(${p})`, pane: "price", lines: [{ name: def.mn, v }], read: (i) => `${f(v[i])} · үнэ ${c[i] > v[i] ? "дээгүүр" : "доогуур"}`, vote: (i) => Math.sign(c[i] - v[i]) || 0 }; }
    case "rsi": { const v = rsi(c, p); return { id, label: `RSI(${p})`, pane: "sub", lines: [{ name: "RSI", v }], ref: [30, 70], read: (i) => `${f(v[i], 1)}${v[i] < 30 ? " · хэт зарагдсан" : v[i] > 70 ? " · хэт авагдсан" : ""}`, vote: (i) => (v[i] > 55 ? 1 : v[i] < 45 ? -1 : 0) }; }
    case "macd": { const m = macd(c); return { id, label: "MACD(12,26,9)", pane: "sub", lines: [{ name: "MACD", v: m.line }, { name: "Дохио", v: m.signal }], ref: [0], read: (i) => `хистограм ${f(m.hist[i])} · ${m.hist[i] > 0 ? "эерэг" : "сөрөг"}`, vote: (i) => Math.sign(m.hist[i]) || 0 }; }
    case "bb": { const g = boll(c, p, 2); return { id, label: `Bollinger(${p},2)`, pane: "price", lines: [{ name: "Дээд", v: g.up }, { name: "Дунд", v: g.mid }, { name: "Доод", v: g.lo }], read: (i) => `${f(g.lo[i])} – ${f(g.up[i])}`, vote: (i) => Math.sign(c[i] - g.mid[i]) || 0 }; }
    case "pctb": { const g = boll(c, p, 2), v = c.map((x, i) => (x - g.lo[i]) / (g.up[i] - g.lo[i] || 1)); return { id, label: `%B(${p})`, pane: "sub", lines: [{ name: "%B", v }], ref: [0, 1], read: (i) => f(v[i], 2), vote: (i) => (v[i] > 0.6 ? 1 : v[i] < 0.4 ? -1 : 0) }; }
    case "atr": { const v = atr(b, p); return { id, label: `ATR(${p})`, pane: "sub", lines: [{ name: "ATR", v }], read: (i) => f(v[i]), vote: () => 0 }; }
    case "adx": { const g = adx(b, p); return { id, label: `ADX(${p})`, pane: "sub", lines: [{ name: "ADX", v: g.adx }], ref: [20], read: (i) => `${f(g.adx[i], 1)} · ${g.pdi[i] > g.mdi[i] ? "+DI" : "−DI"} тэргүүлж`, vote: (i) => (g.adx[i] >= 20 ? Math.sign(g.pdi[i] - g.mdi[i]) || 0 : 0) }; }
    case "stoch": { const v = stoch(b, p, 3); return { id, label: `Stochastic(${p},3)`, pane: "sub", lines: [{ name: "%K", v }], ref: [20, 80], read: (i) => f(v[i], 1), vote: (i) => (v[i] > 60 ? 1 : v[i] < 40 ? -1 : 0) }; }
    case "ichi": { const t = b.map((_, i) => mid(b, i, 9)), k = b.map((_, i) => mid(b, i, 26)); return { id, label: "Ichimoku(9,26)", pane: "price", lines: [{ name: "Tenkan", v: t }, { name: "Kijun", v: k }], read: (i) => `Tenkan ${f(t[i])} · Kijun ${f(k[i])} · ${t[i] > k[i] ? "өсөх" : "унах"}`, vote: (i) => Math.sign(t[i] - k[i]) || 0 }; }
    case "vwap": { let d = -1, w = 0, s = 0; const v = b.map((x) => { const q = Math.floor(x.t / 864e5); if (q !== d) { d = q; w = 0; s = 0; } const u = Math.max(x.v, 1e-9); w += u; s += ((x.h + x.l + x.c) / 3) * u; return s / w; }); return { id, label: "VWAP (өдөр)", pane: "price", lines: [{ name: "VWAP", v }], read: (i) => `${f(v[i])} · үнэ ${c[i] > v[i] ? "дээгүүр" : "доогуур"}`, vote: (i) => Math.sign(c[i] - v[i]) || 0 }; }
    case "sar": { const v = psar(b); return { id, label: "SAR(0.02,0.2)", pane: "price", lines: [{ name: "SAR", v, dots: true }], read: (i) => `${f(v[i])} · ${c[i] > v[i] ? "өсөх" : "унах"}`, vote: (i) => Math.sign(c[i] - v[i]) || 0 }; }
    case "st": { const g = supertrend(b, p, 3); return { id, label: `Supertrend(${p},3)`, pane: "price", lines: [{ name: "Supertrend", v: g.line }], read: (i) => `${f(g.line[i])} · ${g.dir[i] > 0 ? "өсөх" : "унах"}`, vote: (i) => g.dir[i] || 0 }; }
    case "kst": { const a = sma(rocP(c, 10), 10), e = sma(rocP(c, 15), 10), g = sma(rocP(c, 20), 10), h = sma(rocP(c, 30), 15), v = a.map((x, i) => (Number.isFinite(h[i]) ? x + 2 * e[i] + 3 * g[i] + 4 * h[i] : 0)), s = sma(v, 9); return { id, label: "KST", pane: "sub", lines: [{ name: "KST", v }, { name: "Дохио", v: s }], ref: [0], read: (i) => `${f(v[i], 2)} · дохионоос ${v[i] > s[i] ? "дээш" : "доош"}`, vote: (i) => Math.sign(v[i] - s[i]) || 0 }; }
    case "mfi": { const v = mfi(b, p); return { id, label: `MFI(${p})`, pane: "sub", lines: [{ name: "MFI", v }], ref: [20, 80], read: (i) => f(v[i], 1), vote: (i) => (v[i] > 55 ? 1 : v[i] < 45 ? -1 : 0) }; }
    case "dpo": { const s = sma(c, p), h = Math.floor(p / 2) + 1, v = c.map((_, i) => (i >= h ? c[i - h] - s[i] : NaN)); return { id, label: `DPO(${p})`, pane: "sub", lines: [{ name: "DPO", v }], ref: [0], read: (i) => f(v[i]), vote: (i) => Math.sign(v[i]) || 0 }; }
    case "rvol": { const s = sma(b.map((x) => x.v), p), v = b.map((x, i) => (s[i] ? x.v / s[i] : NaN)); return { id, label: `RelVol(${p})`, pane: "sub", lines: [{ name: "RelVol", v }], ref: [1], read: (i) => `${f(v[i], 2)}×`, vote: (i) => (v[i] > 1.3 ? Math.sign(b[i].c - b[i].o) || 0 : 0) }; }
    case "ad": { let s = 0; const v = b.map((x) => (s += x.h > x.l ? ((x.c - x.l - (x.h - x.c)) / (x.h - x.l)) * x.v : 0)); return { id, label: "A/D", pane: "sub", lines: [{ name: "A/D", v }], read: (i) => (i >= 12 && v[i] > v[i - 12] ? "хуримтлал" : "тархалт"), vote: (i) => (i >= 12 ? Math.sign(v[i] - v[i - 12]) || 0 : 0) }; }
  }
  return null;
}
