import type { Bar } from "../scalp/ind";
import { bars, deep, closedOf, quote, SYMBOLS, TF_MIN, type Sym, type TF } from "./market";
import { ctxOf, ctxReady, structureAt, planAt, patternAt, drawAt, indicator, INDICATORS, STRATS, type IndOut, type Strat } from "./engine";
import { stats, verdict } from "./report";
import { liveStats } from "./learn";
import { nextNews } from "./news";

/* ─── Tesla Trader · ҮНЭН ШАЛГАХ ХӨДӨЛГҮҮР (2026-11-06) ──────────────────────
   Хэрэглэгч сонгох юм алга: 18 индикатор бүгд, хаагдсан лаан дээр (repaint-гүй) нэг дор уншигдана.
   Гол асуулт нь «индикатор юу гэж байна» биш, «ийм санал түүхэнд ажилласан уу»:
   · Суурь хувь: одоогийн саналын бүс түүхэнд дараагийн 12 лаанд хэдэн хувь зөв байсан, ердийн үетэй жишинэ.
     Цонх давхцахгүй (12 лаа тутам), Wilson 95% завсар. Завсар ердийн хувийг хамарвал «зоос шидэхтэй адил».
     «Давуу тал» гэж нэрлэхэд хагас хоёр хугацаанд ижил чиглэлтэй, шимтгэл хассан дүн эерэг байх ёстой.
   · Хөдөлгөөний хүрээ: ATR·√хугацаа масштабтай 80% бүс. Эхний хагаст тааруулж, хоёр дахь хагаст шалгасан бодит таарц.
   · Бие даасан санал: 18 индикаторын корреляциас тооцсон үр дүнтэй тоо (n²/Σr²).
   Индикаторын мэдээ, гарчгийн сэтгэл хөдлөл зэрэг хэмжээгүй зүйл энд орохгүй. Босгыг сулруулахгүй. */

export const READ_TFS: TF[] = ["1m", "5m", "15m", "1H", "4H", "1D"];
export const H = 12;
const WARM = 200, DIR = 0.2, ALL = INDICATORS.map((q) => ({ id: q.id, p: q.p || undefined }));
/* 0 тренд · 1 импульс · 2 хэмжээ. ATR чиглэл заадаггүй: уншигдана, хүрээнд ашиглагдана, санал тоолохгүй. */
const GROUP: Record<string, number> = { ema: 0, sma: 0, st: 0, ichi: 0, sar: 0, vwap: 0, bb: 0, rsi: 1, macd: 1, stoch: 1, kst: 1, pctb: 1, mfi: 1, dpo: 1, adx: 2, rvol: 2, ad: 2, atr: 2 };
const VOTERS = ALL.length - 1;

const bucketOf = (x: number) => (x <= -0.5 ? 0 : x <= -DIR ? 1 : x < DIR ? 2 : x < 0.5 ? 3 : 4);
function wilson(w: number, n: number, z = 1.96) { const p = w / n, d = 1 + (z * z) / n, m = p + (z * z) / (2 * n), r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n)); return [(m - r) / d, (m + r) / d]; }
const pct = (v: number[], q: number) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
const all = (b: Bar[], d: number) => ALL.map((q) => indicator(q.id, q.p, b, d)).filter((v): v is IndOut => !!v);
const netOf = (v: number[]) => { const up = v.filter((x) => x > 0).length, dn = v.filter((x) => x < 0).length; return { up, dn, flat: v.length - up - dn, net: (up - dn) / VOTERS }; };

type Bk = { n: number; up: number; a: [number, number]; b: [number, number]; sum: number };
export type Truth = { at: number; bars: number; from: number; to: number; n: number; baseUp: number; bk: Bk[]; k: number; cov: number; covN: number; neff: number };

async function compute(sym: Sym, tf: TF): Promise<Truth | null> {
  const b = closedOf(await deep(sym, tf), tf), n = b.length;
  if (n < WARM + H * 40) return null;
  const S = SYMBOLS[sym], o = all(b, S.digits), x = ctxOf(b, tf, S.cost), c = x.c;
  const V = o.map((q) => { const v = new Int8Array(n); for (let i = WARM; i < n; i++) { const s = q.vote(i); v[i] = s > 0 ? 1 : s < 0 ? -1 : 0; } return v; });
  const bk: Bk[] = Array.from({ length: 5 }, () => ({ n: 0, up: 0, a: [0, 0], b: [0, 0], sum: 0 }));
  let tot = 0, ups = 0;
  const mid = WARM + (n - WARM) / 2, zs: number[] = [];
  for (let i = WARM; i + H < n; i += H) {
    const m = c[i + H] - c[i];
    if (x.a[i] > 0) zs.push(Math.abs(m) / (x.a[i] * Math.sqrt(H)));
    if (!m) continue;
    const v = V.map((q) => q[i]), k = bucketOf(netOf(v).net), r = bk[k], u = m > 0 ? 1 : 0, d = k > 2 ? 1 : k < 2 ? -1 : 0;
    r.n++; r.up += u; r.sum += (d * m - (d ? S.cost(c[i]) : 0)) / c[i]; tot++; ups += u;
    const side = i < mid ? r.a : r.b; side[0]++; side[1] += u;
  }
  const half = zs.length >> 1, k1 = pct(zs.slice(0, half), 0.8), test = zs.slice(half);
  /* бие даасан саналын тоо: n²/Σr² (корреляцийн матрицын participation ratio) */
  const live = V.filter((v) => { let a = 0; for (let i = WARM; i < n; i++) a += v[i] * v[i]; return a > 0; }).map((v) => { let m = 0; for (let i = WARM; i < n; i++) m += v[i]; m /= n - WARM; let s = 0; const d = new Float64Array(n); for (let i = WARM; i < n; i++) { d[i] = v[i] - m; s += d[i] * d[i]; } return { d, s: Math.sqrt(s) }; });
  let rr = 0;
  for (const p of live) for (const q of live) { let r = 0; for (let i = WARM; i < n; i++) r += p.d[i] * q.d[i]; rr += (r / (p.s * q.s)) ** 2; }
  return { at: Date.now(), bars: n, from: b[WARM].t, to: b[n - 1].t, n: tot, baseUp: tot ? ups / tot : 0.5, bk, k: pct(zs, 0.8), cov: test.length ? test.filter((z) => z <= k1).length / test.length : 0, covN: test.length, neff: +((live.length * live.length) / rr).toFixed(1) };
}

type Cell = { id: string; label: string; g: number; v: number; read: string };
type Snap = { cells: Cell[]; up: number; dn: number; flat: number; net: number; dir: number };
const G = globalThis as { __deskTruth?: Map<string, Truth | null>; __deskTruthRun?: boolean; __deskSnap?: Map<string, Snap> };
const box = (G.__deskTruth ??= new Map()), snaps = (G.__deskSnap ??= new Map());
const STALE = 30 * 60e3;
async function truthOf(sym: Sym, tf: TF) {
  const key = `${sym}:${tf}`, c = box.get(key);
  if (c && Date.now() - c.at < STALE) return c;
  const v = await compute(sym, tf).catch(() => null);
  if (v) box.set(key, v);
  return v ?? c ?? null;
}
/* сервер асахад ба 20 минут тутам дэвсгэрт бэлдэнэ, хэрэглэгч хүлээхгүй */
export function startTruthWarm() {
  if (G.__deskTruthRun) return;
  G.__deskTruthRun = true;
  const go = async () => { for (const sym of Object.keys(SYMBOLS) as Sym[]) for (const tf of READ_TFS) { await truthOf(sym, tf).catch(() => null); await new Promise((r) => setTimeout(r, 400)); } };
  setTimeout(() => go().catch(() => {}), 60e3).unref?.();
  setInterval(() => go().catch(() => {}), 20 * 60e3).unref?.();
}

function snap(sym: Sym, b: Bar[]): Snap {
  const i = b.length - 1, o = all(b, SYMBOLS[sym].digits), cells = o.map((q) => { const s = q.vote(i); return { id: q.id, label: q.label, g: GROUP[q.id], v: s > 0 ? 1 : s < 0 ? -1 : 0, read: q.read(i) }; });
  const m = netOf(cells.filter((q) => q.id !== "atr").map((q) => q.v));
  return { cells, ...m, dir: m.net >= DIR ? 1 : m.net <= -DIR ? -1 : 0 };
}
async function snapOf(sym: Sym, tf: TF) {
  const b = closedOf(await bars(sym, tf), tf), key = `${sym}:${tf}:${b[b.length - 1]?.t}`, c = snaps.get(key);
  if (c) return { b, s: c };
  const s = snap(sym, b);
  if (snaps.size > 60) snaps.clear();
  snaps.set(key, s);
  return { b, s };
}

/** Одоогийн саналын бүс түүхэнд яаж ажилласан */
function judge(t: Truth | null, s: { net: number; dir: number }) {
  if (!t) return null;
  const r = t.bk[bucketOf(s.net)], up = s.dir >= 0;
  if (!r.n) return { kind: "few", p: null, base: null, lo: null, hi: null, n: 0, wins: 0, up };
  const wins = up ? r.up : r.n - r.up, p = wins / r.n, base = up ? t.baseUp : 1 - t.baseUp, [lo, hi] = wilson(wins, r.n);
  const half = (x: [number, number]) => (x[0] ? (up ? x[1] : x[0] - x[1]) / x[0] - base : 0), stable = half(r.a) * half(r.b) > 0 && half(r.a) > 0, exp = r.sum / r.n;
  const kind = !s.dir ? "mixed" : r.n < 30 ? "few" : hi < base ? "opposite" : lo <= base ? "coin" : stable && exp > 0 ? "edge" : "weak";
  return { kind, p: +(p * 100).toFixed(1), base: +(base * 100).toFixed(1), lo: +(lo * 100).toFixed(1), hi: +(hi * 100).toFixed(1), n: r.n, wins, up };
}
const hLabel = (tf: TF) => { const m = TF_MIN[tf] * H; return m < 60 ? `${m} минут` : m < 1440 ? `${m / 60} цаг` : `${m / 1440} өдөр`; };
function sentence(dir: number, kind: string | undefined, p: number | null | undefined) {
  if (!dir) return "Индикаторууд хоорондоо зөрж байна, тодорхой чиглэл алга.";
  const w = dir > 0 ? "өсөх" : "унах", done = dir > 0 ? "өссөн" : "унасан", head = `Индикаторууд ${w} гэж байна`;
  if (kind === "edge") return `${head}, ийм үед түүхэнд 100-аас ${Math.round(p ?? 0)} нь ${done}.`;
  if (kind === "opposite") return `${head}, гэхдээ түүхэнд ийм үед ихэвчлэн эсрэгээрээ болсон.`;
  if (kind === "weak") return `${head}, гэхдээ түүхэн давуу тал тогтвортой биш.`;
  if (kind === "few") return `${head}, гэхдээ шалгах жишээ хангалтгүй.`;
  return `${head}, гэхдээ түүхэнд энэ нь зоос шидэхтэй адил байсан.`;
}
const SHORT: Record<Strat, string> = { pullback: "Буцалт", sweep: "Шүүрдэлт", smc: "Order block" };

/* нэг хэрэглэгч 3 чарт нээдэг тул Mongo бүртгэлийг 30 секунд хадгална */
const lives = new Map<Sym, { at: number; v: Promise<Awaited<ReturnType<typeof liveStats>> | null> }>();
function liveOf(sym: Sym) {
  const c = lives.get(sym);
  if (c && Date.now() - c.at < 30e3) return c.v;
  const v = liveStats(sym).catch(() => null);
  lives.set(sym, { at: Date.now(), v });
  return v;
}

export async function read(sym: Sym, tf: TF) {
  const [{ b, s }, q, t, st0, lv, news, others] = await Promise.all([snapOf(sym, tf), quote(sym).catch(() => null), truthOf(sym, tf), stats().catch(() => null), liveOf(sym), nextNews(sym).catch(() => null), Promise.all(READ_TFS.map(async (x) => ({ tf: x, dir: (await snapOf(sym, x)).s.dir })))]);
  const S = SYMBOLS[sym], x = ctxOf(b, tf, S.cost), i = b.length - 1, px = q?.px || b[i].c, v = judge(t, s);
  if (!ctxReady(x, i)) throw new Error("Дата хангалтгүй байна");
  const st = structureAt(x, i), pat = patternAt(x, i, st.z), unit = t ? t.k * x.a[i] : 0, half = unit * Math.sqrt(H);
  const plans = (Object.keys(STRATS) as Strat[]).map((k) => {
    const r = planAt(x, i, st, k), m = st0?.data[`${sym}:${tf}:${k}`], w = verdict(m), l = lv?.by[`${tf}:${k}`];
    /* «Батлагдсан» нь ±2σ, хагас хоёр хугацаа хоёулаа эерэг. */
    const ok = !!m?.fired && m.fired >= 30 && (m.exp ?? 0) - 2 * (m.se ?? 0) > 0 && (m.h1 ?? 0) > 0 && (m.h2 ?? 0) > 0;
    return { k, mn: SHORT[k], exp: m?.exp ?? null, se: m?.se ?? null, n: m?.fired ?? 0, tag: w.k, ok, live: l?.n ?? 0, liveExp: l?.exp ?? null, plan: "none" in r ? null : r };
  });
  const verified = plans.find((p) => p.ok && p.plan) ?? null, shown = verified ?? [...plans].filter((p) => p.plan).sort((p, r) => (r.exp ?? -9) - (p.exp ?? -9))[0] ?? null;
  const above = st.z.filter((w) => w.p > px).sort((p, r) => p.p - r.p)[0], below = st.z.filter((w) => w.p < px).sort((p, r) => r.p - p.p)[0];
  return {
    sym, tf, at: Date.now(), barAt: b[i].t, px, h: hLabel(tf), horizon: H, cells: s.cells, up: s.up, dn: s.dn, flat: s.flat, net: +s.net.toFixed(2), dir: s.dir, neff: t?.neff ?? null, voters: VOTERS,
    truth: v, sample: t && { n: t.n, from: t.from, to: t.to }, sentence: sentence(s.dir, v?.kind, v?.p),
    range: t && { half: +half.toFixed(S.digits), pct: +((half / px) * 100).toFixed(2), lo: +(px - half).toFixed(S.digits), hi: +(px + half).toFixed(S.digits), unit: +unit.toFixed(S.digits + 1), cov: +(t.cov * 100).toFixed(1), covN: t.covN },
    levels: { sup: below?.p ?? null, res: above?.p ?? null }, plans: plans.map((p) => ({ ...p, plan: undefined, has: !!p.plan })), plan: verified?.plan ?? null, planK: shown?.mn ?? null, levelsPlan: shown?.plan ?? null, verified: !!verified,
    draw: drawAt(x, i, st, shown?.plan ?? null, pat), live: lv && { fired: lv.fired, tp: lv.tp, sl: lv.sl, open: lv.open }, news, matrix: others,
  };
}
