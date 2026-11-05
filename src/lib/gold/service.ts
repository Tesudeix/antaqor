import mongoose, { Schema, type Model as MModel } from "mongoose";
import dbConnect from "@/lib/mongodb";
import type { Bar } from "../scalp/ind";
import { local } from "../scalp/engine";
import { duka, dukaSince, liveM1, closed, bbo, news, type NewsEv } from "../scalp/feeds";
import { computeFeatures, sessionOf, SESSION_MN, FAM_MN, type GoldData, type Fam } from "./features";
import { buildModel, scoreAt, levelsFor, volPred, TAIL_K, SPREAD, type Model } from "./model";

/* ─── Tesla Trader · XAU/USD сервис (2026-11-05) ───
   analyze()  — «Шинжлэх» товч: бодит 1 мин алтны дата → 86 онцлог → walk-forward-оор шалгасан модель → шийдвэр.
   Модель 12 цаг тутам ~4 сарын датагаар дахин сургагдана (дэвсгэрт, ≈40 с), Mongo `goldmodels`-д хадгална.
   Сигнал ЗӨВХӨН: тухайн горимд walk-forward давуу тал эерэг (Model.on) + |оноо| ≥ босго + бүх шүүлтүүр нээлттэй.
   Үгүй бол ХҮЛЭЭХ — гэхдээ хандлага ба шалгагдсан магадлалыг ил харуулна. */

const XAU = { src: "duka" as const, ticker: "XAU/USD", sq: "XAU/USD" };
const LEGS: [string, number][] = [["EUR/USD", -0.576], ["USD/JPY", 0.136], ["GBP/USD", -0.119], ["USD/CAD", 0.091], ["USD/SEK", 0.042], ["USD/CHF", 0.036]];
const SQ_BASE = 0.64;                       /* Swissquote prime-ийн ердийн алтны spread ($), 2026-11-04 хэмжсэн */

const GoldModelDoc: MModel<{ key: string; data: Model }> = (mongoose.models.GoldModel as MModel<{ key: string; data: Model }>) ||
  mongoose.model("GoldModel", new Schema({ key: { type: String, unique: true }, data: Schema.Types.Mixed }, { timestamps: true }));

function dxyMap(legs: Bar[][]): Map<number, number> {
  const times = [...new Set(legs.flatMap((l) => l.map((b) => b.t)))].sort((a, b) => a - b);
  const maps = legs.map((l) => new Map(l.map((b) => [b.t, b.c]))), last = LEGS.map(() => NaN), out = new Map<number, number>();
  for (const t of times) {
    maps.forEach((m, k) => { const v = m.get(t); if (v !== undefined) last[k] = v; });
    if (last.every(Number.isFinite)) out.set(t, 50.14348112 * LEGS.reduce((s, [, w], k) => s * last[k] ** w, 1));
  }
  return out;
}

/* ── модель: санах ой → Mongo → дэвсгэрт дахин сургалт ── */
let model: Model | null = null, training: Promise<void> | null = null, trainErr = "";
export async function train() {
  if (training) return training;
  training = (async () => {
    const from = Date.now() - 120 * 864e5;
    const m1 = await dukaSince(XAU.ticker, "1MIN", from, 30000);
    const h1 = await duka(XAU.ticker, 5000, Date.now(), "1HOUR"), d1 = await duka(XAU.ticker, 1500, Date.now(), "1DAY");
    const legs: Bar[][] = [];
    for (const [s] of LEGS) legs.push(await dukaSince(s, "5MIN", from - 5 * 864e5, 5000));
    const m = buildModel(computeFeatures({ m1, h1, d1, dxy: dxyMap(legs) }));
    await dbConnect();
    await GoldModelDoc.updateOne({ key: "xau" }, { $set: { data: m } }, { upsert: true });
    model = m; trainErr = "";
  })().catch((e) => { trainErr = (e as Error).message; console.error("[gold train]", trainErr); }).finally(() => { training = null; });
  return training;
}
async function getModel(): Promise<Model | null> {
  if (!model) { await dbConnect(); model = (await GoldModelDoc.findOne({ key: "xau" }).lean<{ data: Model }>())?.data || null; }
  if (!training && (!model || Date.now() - model.fittedAt > 12 * 3600e3)) train();
  return model;
}

/* ── бодит цагийн өгөгдөл ── */
const memo = new Map<string, { at: number; v: unknown; p?: Promise<unknown> }>();
async function cached<T>(key: string, ttl: number, f: () => Promise<T>): Promise<T> {
  const c = memo.get(key);
  if (c && Date.now() - c.at < ttl) return c.v as T;
  if (c?.p) return c.p as Promise<T>;
  const p = f().then((v) => { memo.set(key, { at: Date.now(), v }); return v; }).finally(() => { const x = memo.get(key); if (x) x.p = undefined; });
  memo.set(key, { at: c?.at ?? 0, v: c?.v, p });
  return p;
}
async function liveData(): Promise<GoldData> {
  const [m1, h1, d1, legs] = await Promise.all([
    liveM1(XAU, 8000).then((b) => closed(b)),
    cached("h1", 5 * 60e3, () => duka(XAU.ticker, 1200, Date.now(), "1HOUR")),
    cached("d1", 3600e3, () => duka(XAU.ticker, 300, Date.now(), "1DAY")),
    cached("legs", 60e3, () => Promise.all(LEGS.map(([s]) => duka(s, 2500, Date.now(), "5MIN")))),
  ]);
  return { m1, h1, d1, dxy: dxyMap(legs) };
}
export async function quote() {
  const q = await bbo(XAU, 4000);
  return q ? { bid: q.bid, ask: q.ask, spread: +q.spread.toFixed(2), t: q.ts } : null;
}

/* ── шинжилгээ ── */
const r2 = (x: number) => +x.toFixed(2);
export async function analyze() {
  const now = Date.now();
  const [D, q, ev, m] = await Promise.all([liveData(), bbo(XAU, 4000), news(), getModel()]);
  const fs = computeFeatures(D, { onlyLast: 3 });
  const S = fs.S[fs.S.length - 1];
  if (!S) throw new Error("Алтны дата хангалтгүй байна — хэдэн минутын дараа дахин оролдоно уу");
  const m5 = fs.m5, j = m5.length - 1, last1 = D.m1[D.m1.length - 1];
  const age = Math.round((now - (last1.t + 60000)) / 1000), stale = now - S.t > 12 * 60000;
  const ses = sessionOf(now), widen = q ? q.spread / SQ_BASE : 1, spread = SPREAD * Math.max(1, widen);
  const reg = { kind: S.regime ? "trend" : "range", adx: r2(fs.ctx.adx[j]), er: r2(fs.ctx.er[j]), atrPct: Math.round((fs.ctx.atrPct[j] || 0) * 100), chop: Math.round(fs.ctx.chop[j]), hurst: r2(fs.ctx.hurst(j)) };
  const ny = local("America/New_York", now);
  const weekend = ny.dow === 6 || (ny.dow === 0 && ny.min < 1080) || (ny.dow === 5 && ny.min >= 1020);
  const usd = ev.filter((e) => (e.ccy === "USD" || e.ccy === "CNY") && e.impact !== "Low");
  const hot = usd.find((e) => e.impact === "High" && Math.abs(e.t - now) <= 15 * 60e3), soon = usd.find((e) => e.impact === "High" && e.t > now && e.t - now <= 60 * 60e3);
  const mn = (t: number) => Math.max(1, Math.round(Math.abs(t - now) / 60000));
  const gates = [
    { key: "market", label: "Зах / дата", ok: !weekend && !stale && age < 300, text: weekend ? "Амралтын өдөр — алтны зах хаалттай" : stale ? `Сүүлийн хүчинтэй M5 хаалт ${mn(S.t)} мин өмнө (rollover эсвэл завсарлага)` : `Бодит цаг · сүүлийн лаа ${age} с өмнө` },
    { key: "session", label: "Сешн", ok: ses !== "rollover", warn: ses === "asia" || ses === "late", text: `${SESSION_MN[ses]}${ses === "asia" ? " — хөрвөх чадвар нимгэн, хөдөлгөөн бага" : ses === "late" ? " — COMEX хаагдсан, идэвх буурна" : ""}` },
    hot ? { key: "news", label: "Мэдээ", ok: false, text: `${hot.ccy} «${hot.title}» ${mn(hot.t)} мин ${hot.t > now ? "дараа" : "өмнө"} — ±15 мин арилжаа хийхгүй` }
      : soon ? { key: "news", label: "Мэдээ", ok: true, warn: true, text: `${soon.ccy} «${soon.title}» ${mn(soon.t)} мин дараа — түүнээс өмнө байрлалаа хаа` }
      : { key: "news", label: "Мэдээ", ok: true, text: "Ойрын 1 цагт өндөр нөлөөтэй мэдээ алга" },
    { key: "spread", label: "Spread", ok: widen <= 2.5, warn: widen > 1.6, text: q ? `$${q.spread.toFixed(2)} (ердийн $${SQ_BASE})${widen > 2.5 ? " — хэт өргөссөн" : widen > 1.6 ? " — өргөсөж байна" : ""}` : "Spread мэдэгдэхгүй — ердийнхөөр тооцов" },
    { key: "vol", label: "Хэлбэлзэл", ok: reg.atrPct >= 8 && reg.atrPct <= 97, text: `ATR(M5) $${S.a5.toFixed(2)} · өдрийн ${reg.atrPct}-р хувьд${reg.atrPct > 97 ? " — эмх замбараагүй" : reg.atrPct < 8 ? " — хэт тайван" : ""}` },
  ];
  const blocked = gates.find((g) => !g.ok);

  /* модель */
  let decision: "BUY" | "SELL" | "WAIT" = "WAIT", reason = "", score = 0, thr = 99, pUp = 50, parts: { key: string; fam: string; mn: string; z: number; w: number; c: number }[] = [], plan = null as null | ReturnType<typeof levelsFor>;
  if (m) {
    const sc = scoreAt(m, fs, fs.S.length - 1);
    score = r2(sc.S); thr = sc.thr; parts = sc.parts.map((p) => ({ ...p, c: +p.c.toFixed(3) })).sort((a, b) => Math.abs(b.c) - Math.abs(a.c));
    const bin = m.calib.find((b) => score >= b.lo && score < b.hi);
    pUp = bin ? bin.pUp : 50;
    const dir = Math.sign(score), on = m.on[S.regime];
    if (blocked) reason = blocked.text;
    else if (!m.reg[S.regime].sel.length) reason = "Энэ горимд тогтвортой сигнал өгдөг онцлог олдсонгүй — шуугиан.";
    else if (Math.abs(score) < thr) reason = `Оноо ${score > 0 ? "+" : ""}${score}σ — босго ±${thr}σ-д хүрээгүй, шуугианы бүс.`;
    else if (!on) reason = `Оноо ${score > 0 ? "+" : ""}${score}σ босго давсан ч энэ горимд walk-forward шалгалтаар spread-ийг давах давуу тал батлагдаагүй (${m.wf[S.regime].trades} арилжаа, ${(m.wf[S.regime].exp ?? 0) > 0 ? "+" : ""}${m.wf[S.regime].exp}R) — систем дуугүй байна.`;
    else {
      decision = dir > 0 ? "BUY" : "SELL";
      const entry = q ? (dir > 0 ? q.ask : q.bid) : S.c;
      plan = levelsFor(dir, entry, S, spread);
      reason = `Оноо ${score > 0 ? "+" : ""}${score}σ (босго ±${thr}σ), горимын шалгалт эерэг.`;
    }
  } else reason = trainErr ? `Модель сургаж чадсангүй: ${trainErr}` : "Модель анх удаа сургагдаж байна (≈1 мин) — дахин дарна уу.";

  /* хэлбэлзлийн таамаг: дараагийн 30 мин хүрээ + нэг талын зайд хүрэх магадлал (walk-forward-оор тохируулсан) */
  let vol = null as null | { range: number; hi80: number; noiseStop: number; r2: number; n: number; mape: number; touch: { d: number; p: number }[] };
  if (m?.vol?.beta?.length) {
    const pred = volPred(m.vol, S), tail = m.vol.tail;
    const pAt = (k: number) => {
      if (k <= TAIL_K[0]) return tail[0] + (100 - tail[0]) * (1 - k / TAIL_K[0]);
      const i = TAIL_K.findIndex((x) => x >= k);
      if (i < 0) return tail[tail.length - 1];
      const t = (k - TAIL_K[i - 1]) / (TAIL_K[i] - TAIL_K[i - 1]);
      return tail[i - 1] + (tail[i] - tail[i - 1]) * t;
    };
    const round = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);
    const ds = [...new Set([0.25, 0.5, 0.75, 1, 1.25].map((k) => round(k * pred)))];
    const k25 = TAIL_K.find((_, i) => tail[i] <= 25) ?? 1;
    vol = { range: r2(pred), hi80: r2(pred * m.vol.cover80), noiseStop: round(k25 * pred), r2: m.vol.r2, n: m.vol.n, mape: m.vol.mape, touch: ds.map((d) => ({ d, p: Math.round(pAt(d / pred)) })) };
  }
  /* оноо чиглэлийг ялгаж байна уу: бүх муж дахь «өссөн %» бараг ижил бол үгүй */
  const big = (m?.calib || []).filter((b) => b.n >= 200), span = big.length ? Math.max(...big.map((b) => b.pUp)) - Math.min(...big.map((b) => b.pUp)) : 0;
  const dirNote = m && span < 6 ? `Онооны бүх мужид өсөх магадлал ${Math.min(...big.map((b) => b.pUp))}–${Math.max(...big.map((b) => b.pUp))}% — оноо одоогоор чиглэлийг найдвартай ялгахгүй байна.` : "";

  /* түлхүүр түвшин */
  const asia = fs.ctx.asia.get(Math.floor(m5[j].t / 864e5));
  const px = q ? (q.bid + q.ask) / 2 : S.c, base = Math.floor(px / 10) * 10;
  const levels = [
    { k: "pdh", label: "Өчигдрийн оргил", p: fs.ctx.pdh[j] }, { k: "pdl", label: "Өчигдрийн ёроол", p: fs.ctx.pdl[j] },
    { k: "vwap", label: "VWAP (өдөр)", p: fs.ctx.vwap[j] },
    ...(asia && Number.isFinite(asia.hi) ? [{ k: "ah", label: "Азийн оргил", p: asia.hi }, { k: "al", label: "Азийн ёроол", p: asia.lo }] : []),
    { k: "r1", label: "$10 түвшин", p: base + 10 }, { k: "r0", label: "$10 түвшин", p: base },
  ].filter((x) => Number.isFinite(x.p)).map((x) => ({ ...x, p: r2(x.p), dist: r2(x.p - px) })).sort((a, b) => b.p - a.p);

  const from = Math.max(0, j - 95), bars = m5.slice(from, j + 1);
  const famCount = (Object.keys(FAM_MN) as Fam[]).map((f) => ({ fam: f, mn: FAM_MN[f], total: fs.defs.filter((d) => d.fam === f).length, picked: m ? m.screen.filter((x) => x.fam === f && (x.picked[0] || x.picked[1])).length : 0 }));
  return {
    now, price: q ? { bid: q.bid, ask: q.ask, spread: r2(q.spread) } : { bid: S.c, ask: S.c, spread: SPREAD }, barT: S.t, age,
    session: ses, sessionMn: SESSION_MN[ses], regime: reg, gates,
    decision, reason, score, thr, pUp, dirNote, vol, horizon: 30, plan: plan && { ...plan, entry: r2(plan.entry), sl: r2(plan.sl), tp1: r2(plan.tp1), tp2: r2(plan.tp2), risk: r2(plan.risk), costR: r2(plan.costR) },
    drivers: parts, levels, famCount, atr5: r2(S.a5),
    model: m && {
      fittedAt: m.fittedAt, from: m.from, to: m.to, samples: m.samples, folds: m.folds, wfFrom: m.wfFrom, on: m.on, wf: m.wf, total: m.total,
      sel: m.reg.map((r) => r.sel.map((x) => ({ key: x.key, mn: x.mn, fam: x.fam, ic: x.ic }))), thr: m.reg.map((r) => r.thr), calib: m.calib, recent: m.recent.slice(0, 24),
      noise: m.screen.filter((x) => !x.picked[0] && !x.picked[1]).length,
    },
    training: !!training,
    news: usd.filter((e) => e.t > now - 15 * 60e3 && e.t - now < 10 * 3600e3).sort((a, b) => a.t - b.t).slice(0, 6) as NewsEv[],
    chart: { bars: bars.map((b) => [b.t, r2(b.o), r2(b.h), r2(b.l), r2(b.c)]), e20: bars.map((_, k) => r2(fs.ctx.e20[from + k])), e50: bars.map((_, k) => r2(fs.ctx.e50[from + k])), vwap: bars.map((_, k) => r2(fs.ctx.vwap[from + k])) },
  };
}
export type Analysis = Awaited<ReturnType<typeof analyze>>;
