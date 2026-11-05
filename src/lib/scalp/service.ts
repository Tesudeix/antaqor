import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { ScalpStat, ScalpTrade, type IScalpStat } from "@/models/Scalp";
import {
  UNIVERSE, bySym, build, ready, sessionAt, regimeAt, biasAt, setupAt, plan, simulate, dxyZ, aggregate, macroGate,
  backtest, families, emptyStat, addStat, summarize, grade, local, P, PLAYS, PLAY_MN,
  type Inst, type Series, type Gate, type Summary, type Play, type Stat, type Regime,
} from "./engine";
import { liveM1, closed, bbo, news, history, type NewsEv } from "./feeds";
import type { Bar } from "./ind";

/* ─── Tesla Trader · Scalp сервис (2026-11-04) ───
   board()  — 13 хэрэгслийн товч төлөв (30 с кэш): шүүлтүүр, горим, сигнал/хүлээх бүс.
   detail() — нэг хэрэгсэл: чарт, бүх шүүлтүүр, индикаторын гэр бүл, хэмжсэн давуу тал, мэдээ.
   calibrate() — 28 хоногийн backtest → ScalpStat (24 цаг тутам, GET-ээс автоматаар).
   Журнал — гишүүний «Авсан» арилжаа, өдрийн R, дараалсан алдагдал → тоормос (A9). */

const SEK = { src: "duka" as const, ticker: "USD/SEK" };
const LEGS = ["EURUSD", "USDJPY", "GBPUSD", "USDCAD", "USDSEK", "USDCHF"];
const UB = "Asia/Ulaanbaatar";

/* ── калибровк ── */
type StatRow = Summary & { n14: number; net14: number };
let statCache: { at: number; rows: Map<string, StatRow>; updatedAt: number } = { at: 0, rows: new Map(), updatedAt: 0 };
let calibrating = false;

export async function calibrate() {
  if (calibrating) return;
  calibrating = true;
  try {
    await dbConnect();
    const hist: Record<string, Bar[]> = {};
    for (const inst of UNIVERSE) hist[inst.sym] = await history(inst, 28).catch(() => []);
    hist.USDSEK = await history(SEK, 28).catch(() => []);
    const z = dxyZ(Object.fromEntries(LEGS.map((s) => [s, aggregate(hist[s] || [], 5)])));
    const mid = Date.now() - 14 * 864e5;
    const acc = new Map<string, { st: Stat; n14: number; net14: number; sym: string; kind: string; play: string }>();
    const slot = (key: string, sym: string, kind: string, play: string) => {
      let a = acc.get(key);
      if (!a) { a = { st: emptyStat(), n14: 0, net14: 0, sym, kind, play }; acc.set(key, a); }
      return a;
    };
    for (const inst of UNIVERSE) {
      for (const play of PLAYS) { slot(`${inst.sym}:${play}`, inst.sym, inst.kind, play); slot(`${inst.kind}:${play}`, "", inst.kind, play); }
      if ((hist[inst.sym] || []).length < 5000) continue;
      for (const r of backtest(build(inst, hist[inst.sym]), z)) {
        for (const a of [slot(`${inst.sym}:${r.play}`, inst.sym, inst.kind, r.play), slot(`${inst.kind}:${r.play}`, "", inst.kind, r.play)]) {
          addStat(a.st, r);
          if (r.t >= mid) { a.n14++; a.net14 += r.net; }
        }
      }
    }
    const now = new Date(), from = new Date(Date.now() - 28 * 864e5);
    await ScalpStat.bulkWrite([...acc].map(([key, a]) => ({
      updateOne: { filter: { key }, update: { $set: { sym: a.sym, kind: a.kind, play: a.play, ...a.st, n14: a.n14, net14: +a.net14.toFixed(3), from, to: now, params: { ...P } } }, upsert: true },
    })));
    await ScalpStat.updateOne({ key: "_meta" }, { $set: { sym: "", kind: "", play: "", n: acc.size, from, to: now, params: { ...P } } }, { upsert: true });
    statCache.at = 0;
  } finally { calibrating = false; }
}

async function stats() {
  if (Date.now() - statCache.at < 5 * 60e3 && statCache.at) return statCache;
  await dbConnect();
  const docs = await ScalpStat.find({}).lean<(IScalpStat & { updatedAt: Date })[]>();
  const rows = new Map<string, StatRow>();
  let updatedAt = 0;
  for (const d of docs) {
    if (d.key === "_meta") { updatedAt = new Date(d.updatedAt).getTime(); continue; }
    rows.set(d.key, { ...summarize(d as unknown as Stat), n14: d.n14 || 0, net14: d.n14 ? +(d.net14 / d.n14).toFixed(3) : 0 });
  }
  statCache = { at: Date.now(), rows, updatedAt };
  if (!calibrating && Date.now() - updatedAt > 24 * 3600e3) calibrate().catch((e) => console.error("[scalp calibrate]", (e as Error).message));
  return statCache;
}
/** Хэрэгслийн өөрийн статистик 30+ бол түүнийг, үгүй бол ижил төрлийн (fx/metal/crypto) нийлбэрийг */
function pick(rows: Map<string, StatRow>, inst: Inst, play: Play) {
  const mine = rows.get(`${inst.sym}:${play}`) || null, pooled = rows.get(`${inst.kind}:${play}`) || null;
  return { mine, pooled, use: mine && mine.n >= 30 ? mine : pooled, scope: mine && mine.n >= 30 ? "хэрэгсэл" : "төрөл" };
}

/* ── бодит цагийн цуваа ── */
type LiveS = { S: Series; i: number; lastT: number };
const built = new Map<string, LiveS>();
async function liveSeries(inst: Inst, ttl: number): Promise<LiveS | null> {
  const bars = closed(await liveM1(inst, ttl).catch(() => []));
  if (bars.length < 3000) return null;
  const lastT = bars[bars.length - 1].t, c = built.get(inst.sym);
  if (c && c.lastT === lastT && c.S.m1.length === bars.length) return c;
  const v = { S: build(inst, bars), i: bars.length - 1, lastT };
  built.set(inst.sym, v);
  return v;
}
let dxyCache: { at: number; z: Map<number, number>; p?: Promise<Map<number, number>> } = { at: 0, z: new Map() };
async function dxyLive(): Promise<Map<number, number>> {
  if (Date.now() - dxyCache.at < 30_000) return dxyCache.z;
  if (dxyCache.p) return dxyCache.p;
  dxyCache.p = (async () => {
    const legs: Record<string, Bar[]> = {};
    await Promise.all(LEGS.map(async (s) => { legs[s] = aggregate(closed(await liveM1(s === "USDSEK" ? SEK : bySym(s)!, 30_000).catch(() => [])), 5); }));
    dxyCache = { at: Date.now(), z: dxyZ(legs) };
    return dxyCache.z;
  })().finally(() => { dxyCache.p = undefined; });
  return dxyCache.p;
}
async function lastPrice(sym: string) { const b = closed(await liveM1(bySym(sym)!, 60_000).catch(() => [])); return b[b.length - 1]?.c || 0; }
/** Quote валютын 1 нэгж = ? USD (лот тооцоход) — өөрсдийн бодит ханшаас */
async function usdPer(quote: string) {
  if (quote === "USD") return 1;
  if (quote === "GBP") return lastPrice("GBPUSD");
  const p = await lastPrice(`USD${quote}`);
  return p ? 1 / p : 0;
}

/* ── шүүлтүүрүүд ── */
const mins = (ms: number) => Math.max(1, Math.round(Math.abs(ms) / 60000));
function newsGate(inst: Inst, ev: NewsEv[], now: number): { gate: Gate; next: NewsEv[] } {
  const mine = ev.filter((e) => inst.ccy.includes(e.ccy) && e.impact !== "Low");
  const hot = mine.find((e) => e.impact === "High" && Math.abs(e.t - now) <= 15 * 60e3);
  const warm = mine.find((e) => e.impact === "Medium" && Math.abs(e.t - now) <= 5 * 60e3);
  const soon = mine.find((e) => e.impact === "High" && e.t > now && e.t - now <= 60 * 60e3);
  const next = mine.filter((e) => e.t > now - 15 * 60e3 && e.t - now < 8 * 3600e3).sort((a, b) => a.t - b.t).slice(0, 6);
  const gate: Gate = hot
    ? { key: "news", label: "Мэдээ", ok: false, text: `${hot.ccy} «${hot.title}» ${mins(hot.t - now)} мин ${hot.t > now ? "дараа" : "өмнө"} — өндөр нөлөөтэй мэдээний ±15 мин арилжаа хийхгүй` }
    : warm ? { key: "news", label: "Мэдээ", ok: true, warn: true, text: `${warm.ccy} «${warm.title}» (дунд нөлөө) ${mins(warm.t - now)} мин ${warm.t > now ? "дараа" : "өмнө"}` }
    : soon ? { key: "news", label: "Мэдээ", ok: true, warn: true, text: `${soon.ccy} «${soon.title}» ${mins(soon.t - now)} мин дараа — түүнээс өмнө байрлалаа хаа` }
    : { key: "news", label: "Мэдээ", ok: true, text: "Ойрын 1 цагт өндөр нөлөөтэй мэдээ алга" };
  return { gate, next };
}
const REG_MN: Record<string, string> = { trend: "Тренд", range: "Хүрээ", mixed: "Тодорхойгүй", chaos: "Эмх замбараагүй", dead: "Үхмэл" };

function watchOf(S: Series, i: number, reg: Regime, bias: { dir: number }, fmt: (x: number) => string) {
  const j = S.i5[i], a = S.a5[j], p = S.m1[i].c;
  if (reg.kind === "trend" && bias.dir) {
    const lo = S.e20[j] - 0.25 * a, hi = S.e20[j] + 0.25 * a, up = bias.dir > 0;
    const inZone = p >= lo - 0.1 * a && p <= hi + 0.1 * a;
    return { kind: "zone", lo, hi, text: inZone ? `Үнэ EMA20 (M5) бүсэд байна — M1 дээр EMA9-ийг ${up ? "дээш" : "доош"} давж хаахыг хүлээ.` : `Тренд ${up ? "дээшээ" : "доошоо"}: EMA20 (M5) бүс ${fmt(lo)}–${fmt(hi)} руу буцахыг хүлээ — дундуур нь хөөцөлдөхгүй.` };
  }
  if (reg.kind === "range") return { kind: "range", lo: S.bb.lo[j], hi: S.bb.up[j], text: `Хүрээ ${fmt(S.bb.lo[j])}–${fmt(S.bb.up[j])} (M5 Bollinger). Захад хүрч RSI туйлдах үед эргэлтийг хүлээ.` };
  const r = S.asia.get(Math.floor(S.m1[i].t / 864e5)), lon = local("Europe/London", S.m1[i].t);
  if (S.inst.kind !== "crypto" && r && Number.isFinite(r.hi) && lon.min >= 450 && lon.min < 630 && !(r.upAt && r.dnAt))
    return { kind: "asia", lo: r.lo, hi: r.hi, text: `Азийн хүрээ ${fmt(r.lo)}–${fmt(r.hi)}. London-ий эвдрэл, дараа нь дахин тестийг хүлээ.` };
  if (reg.kind === "chaos") return { kind: "none", text: "Хэлбэлзэл ер бусын өндөр — шуугиан ихтэй үед скальп хийхгүй." };
  if (reg.kind === "dead") return { kind: "none", text: "Хэлбэлзэл хэт бага — хөдөлгөөн spread-ээ ч нөхөхгүй." };
  return { kind: "none", text: `Горим тодорхойгүй (ADX ${reg.adx.toFixed(0)}, ER ${reg.er.toFixed(2)}) — тренд ч, хүрээ ч биш. Хүлээх нь давуу тал.` };
}

function setupText(S: Series, play: Play, dir: number, ctx: Record<string, number>, fmt: (x: number) => string) {
  const up = dir > 0;
  if (play === "pullback") return `M15 чиглэл ${up ? "өсөх" : "унах"}, M5 тренд (ADX ${ctx.adx.toFixed(0)}). Үнэ EMA20 (${fmt(ctx.e20)}) бүс рүү буцаад M1 дээр дахин ${up ? "дээш" : "доош"} эргэлээ — трендийн чиглэлд, үнэ цэнийн бүсээс орно.`;
  if (play === "fade") return `Хүрээтэй зах (ADX ${ctx.adx.toFixed(0)}). Үнэ M5 Bollinger-ийн ${up ? "доод" : "дээд"} хүрээг цоолж RSI ${ctx.rsi.toFixed(0)} болоод M1 дээр эргэлээ — дундаж ${fmt(ctx.mid)} руу буцах санаа.`;
  return `London нээлтээр Азийн ${up ? "оргил" : "ёроол"} ${fmt(ctx.level)} эвдэрч, M1 дээр дахин тестлээд тогтлоо — эвдрэлийн чиглэлд.`;
}
function edgeText(st: StatRow | null, scope: string) {
  if (!st || !st.n) return "Энэ загварт түүхэн дата алга — итгэлцэл хязгаартай.";
  const sign = st.exp > 0 ? "+" : "";
  return `Сүүлийн 28 хоногт (${scope}) ${st.n} удаа: ${st.tp1Rate}% нь TP1 хүрсэн, spread хассаны дараа дунджаар ${sign}${st.exp}R${st.n < 30 ? " — дата бага, санамсаргүй байж болно" : ""}.`;
}

/* ── нэг хэрэгслийн шинжилгээ ── */
export async function analyze(inst: Inst, full: boolean) {
  const now = Date.now();
  const [L, q, ev, z, st] = await Promise.all([
    liveSeries(inst, full ? 10_000 : 30_000), bbo(inst, full ? 8000 : 15000), news(), inst.usd ? dxyLive().catch(() => new Map<number, number>()) : Promise.resolve(new Map<number, number>()), stats(),
  ]);
  const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(inst.digits) : "—");
  const base = { sym: inst.sym, name: inst.name, kind: inst.kind, digits: inst.digits, pip: inst.pip };
  if (!L) return { ...base, ok: false as const, status: "nodata", text: "Ханшийн дата ирсэнгүй — түр хүлээгээд дахин оролдоно." };
  const { S, i } = L, b = S.m1[i], j = S.i5[i];
  const age = Math.max(0, Math.round((now - (b.t + 60000)) / 1000));
  /* зардал = ердийн бүх-зардал spread × одоо Swissquote дээр хэд дахин өргөссөн (≥1) — брокерын spread-ийг шууд мэдэхгүй */
  const widen = q && inst.sqBase ? q.spread / inst.sqBase : 1;
  const spread = inst.spread * Math.max(1, widen);
  const unit = (x: number) => (inst.kind === "fx" ? `${(x / inst.pip).toFixed(1)} пипс` : `$${x.toFixed(inst.kind === "crypto" ? 1 : 2)}`);
  const price = q ? (q.bid + q.ask) / 2 : b.c;
  const reg = regimeAt(S, j), bias = biasAt(S, S.i15[i]), zNow = z.get(S.m5[j].t);
  const ses = sessionAt(inst, now), ng = newsGate(inst, ev, now);
  const shock = S.a1[i] > 0 && b.h - b.l > 4 * S.a1[i];
  const gates: Gate[] = [
    { key: "market", label: "Зах / дата", ok: age <= (inst.kind === "crypto" ? 150 : 240) && ses.name !== "Хаалттай", text: age > 240 ? `Сүүлийн лаа ${Math.round(age / 60)} мин өмнө — ${ses.name === "Хаалттай" ? "зах хаалттай" : "дата хоцорч байна"}` : `Бодит цаг · сүүлийн лаа ${age} с өмнө` },
    { key: "session", label: "Сешн", ok: ses.ok, text: ses.ok ? `${ses.name} — хөрвөх чадвартай цаг` : ses.why },
    ng.gate,
    { key: "spread", label: "Spread", ok: widen <= 2.5, warn: widen > 1.6, text: q ? `${unit(q.spread)} (ердийн ${unit(inst.sqBase || inst.spread)})${widen > 2.5 ? " — хэт өргөссөн" : widen > 1.6 ? " — өргөсөж байна" : ""} · зардлаар ${unit(spread)} тооцов` : `Ердийн ${unit(inst.spread)}-оор тооцов` },
    { key: "vol", label: "Хэлбэлзэл", ok: reg.kind !== "chaos" && reg.kind !== "dead" && !shock, text: shock ? "Сүүлийн минутад цочрол (4×ATR) — тайвшрахыг хүлээ" : reg.kind === "chaos" ? `ATR өдрийн ${Math.round(reg.atrPct * 100)}-р хувьд — эмх замбараагүй` : reg.kind === "dead" ? `ATR өдрийн ${Math.round(reg.atrPct * 100)}-р хувьд — хэт тайван, зардал давна` : `ATR өдрийн ${Math.round(reg.atrPct * 100)}-р хувьд — хэвийн` },
    { key: "regime", label: "Горим", ok: true, warn: reg.kind === "mixed", text: `${REG_MN[reg.kind]} · ADX ${reg.adx.toFixed(0)} · ER ${reg.er.toFixed(2)}${reg.squeeze ? " · шахалт" : ""}` },
  ];
  const blockedBase = gates.find((g) => !g.ok);

  /* сигнал: сүүлийн 3 хаагдсан минутад загвар гарсан уу */
  let sig: null | Record<string, unknown> = null;
  for (let k = i; k >= i - 2 && ready(S, k); k--) {
    const s = setupAt(S, k, regimeAt(S, S.i5[k]), biasAt(S, S.i15[k]));
    if (!s) continue;
    const p = plan(S, s, S.m1[k].c, spread);
    if (!p) continue;
    let missed = "";
    for (let m = k + 1; m <= i; m++) if (s.dir > 0 ? S.m1[m].l <= p.sl : S.m1[m].h >= p.sl) missed = "SL-д хүрчихсэн";
    const now_ = q ? (s.dir > 0 ? q.ask : q.bid) : b.c, run = ((now_ - p.entry) * s.dir) / p.risk;
    if (!missed && run >= 0.5) missed = `Үнэ орох цэгээс ${run.toFixed(1)}R холдсон — хөөцөлдөхгүй`;
    const mg = macroGate(inst, s.dir, zNow), sp = pick(st.rows, inst, s.play);
    const fam = families(S, i, zNow);
    const gr = grade(sp.use, fam, s.dir, p.costR);
    const sigGates: Gate[] = [...(mg ? [mg] : []), { key: "cost", label: "Зардал", ok: p.costR <= 0.2, warn: p.costR > 0.12, text: `Spread = SL-ийн ${p.costR.toFixed(2)}R${p.costR > 0.2 ? " — хэт үнэтэй" : ""}` }];
    const blocked = blockedBase || sigGates.find((g) => !g.ok);
    sig = {
      play: s.play, playMn: PLAY_MN[s.play], dir: s.dir, ...p, ageMin: i - k, grade: gr.grade, gradeWhy: gr.why,
      status: missed ? "missed" : blocked ? "blocked" : gr.grade === "OFF" ? "off" : "live",
      why: missed || (blocked ? blocked.text : gr.grade === "OFF" ? gr.why : ""), gates: sigGates,
      text: {
        setup: setupText(S, s.play, s.dir, s.ctx, fmt),
        manage: `TP1 (+1R) дээр 50%-ийг хааж SL-ийг орох цэг рүү зөө. Үлдсэнийг TP2 (+${p.rr2}R) хүртэл. ${P.maxBars} минутад TP1 хүрэхгүй бол гар.`,
        invalid: `${fmt(p.sl)} давбал санаа хүчингүй (${unit(p.risk)}).`,
        edge: edgeText(sp.use, sp.scope),
      },
    };
    break;
  }
  const watch = sig ? null : watchOf(S, i, reg, bias, fmt);
  const row = {
    ...base, ok: true as const, price, bid: q?.bid ?? null, ask: q?.ask ?? null, spreadPips: +((q?.spread ?? inst.spread) / inst.pip).toFixed(1), spreadTxt: unit(q?.spread ?? inst.spread), age,
    change: +(((b.c - S.m1[Math.max(0, i - 60)].c) / S.a5[j]) || 0).toFixed(1),
    session: ses.name, regime: reg.kind, regimeMn: REG_MN[reg.kind], bias: bias.dir,
    blocked: blockedBase ? { label: blockedBase.label, text: blockedBase.text } : null,
    signal: sig ? { play: sig.play, playMn: sig.playMn, dir: sig.dir, grade: sig.grade, status: sig.status, ageMin: sig.ageMin, entry: sig.entry } : null,
    watch: watch ? { kind: watch.kind, text: watch.text } : null,
  };
  if (!full) return row;

  const fam = families(S, i, zNow);
  const from = Math.max(0, i - 89), bars = S.m1.slice(from, i + 1);
  return {
    ...row, contract: inst.contract, quote: inst.quote, usdPerQuote: await usdPer(inst.quote), typicalPips: +(inst.spread / inst.pip).toFixed(1),
    gates, signal: sig, watch, fam, regimeInfo: { ...reg, atrPct: Math.round(reg.atrPct * 100) }, biasInfo: bias, dxyZ: zNow ?? null, usd: inst.usd,
    edge: Object.fromEntries(PLAYS.filter((p) => inst.kind !== "crypto" || p !== "breakout").map((p) => { const x = pick(st.rows, inst, p); return [p, { name: PLAY_MN[p], mine: x.mine, pooled: x.pooled }]; })),
    edgeUpdated: st.updatedAt || null, params: P,
    news: ng.next,
    chart: {
      bars: bars.map((x) => [x.t, x.o, x.h, x.l, x.c]),
      e9: bars.map((_, k) => S.e9[from + k]), e20: bars.map((_, k) => S.e20[S.i5[from + k]]), vwap: bars.map((_, k) => S.vwap[from + k]),
      vwapKind: S.hasVol ? "VWAP" : "TWAP", watch: watch && "lo" in watch ? { lo: watch.lo, hi: watch.hi } : null,
    },
  };
}

/* ── самбар ── */
const RANK: Record<string, number> = { A: 0, B: 1, C: 2 };
let boardCache: { at: number; data: unknown; p?: Promise<unknown> } = { at: 0, data: null };
export async function board() {
  if (Date.now() - boardCache.at < 15_000 && boardCache.data) return boardCache.data;
  if (boardCache.p) return boardCache.p;
  boardCache.p = (async () => {
    const rows = await Promise.all(UNIVERSE.map((x) => analyze(x, false).catch(() => ({ sym: x.sym, name: x.name, kind: x.kind, digits: x.digits, pip: x.pip, ok: false as const, status: "nodata", text: "Алдаа" }))));
    const score = (r: (typeof rows)[number]) => {
      if (!r.ok) return 99;
      const s = "signal" in r ? r.signal : null;
      if (s && s.status === "live") return RANK[s.grade as string] ?? 3;
      if (r.blocked) return 20;
      if (s) return 6;
      return r.watch?.kind === "zone" || r.watch?.kind === "asia" ? 4 : r.watch?.kind === "range" ? 5 : 10;
    };
    rows.sort((a, b) => score(a) - score(b));
    const ev = await news();
    const now = Date.now(), st = await stats();
    const data = {
      now, clock: clock(now), rows, calibrating, edgeUpdated: st.updatedAt || null,
      news: ev.filter((e) => e.impact === "High" && e.t > now - 15 * 60e3 && e.t - now < 12 * 3600e3).sort((a, b) => a.t - b.t).slice(0, 6),
    };
    boardCache = { at: Date.now(), data };
    return data;
  })().finally(() => { boardCache.p = undefined; });
  return boardCache.p;
}

export function clock(now: number) {
  const lo = local("Europe/London", now), ny = local("America/New_York", now), tk = local("Asia/Tokyo", now);
  const wk = (d: { dow: number }) => d.dow >= 1 && d.dow <= 5;
  const fx = sessionAt(UNIVERSE[0], now);
  let next = 0;
  if (!fx.ok) for (let m = 5; m <= 4 * 1440; m += 5) if (sessionAt(UNIVERSE[0], now + m * 60000).ok) { next = now + m * 60000; break; }
  return {
    tokyo: wk(tk) && tk.min >= 540 && tk.min < 1080, london: wk(lo) && lo.min >= 480 && lo.min < 1020, ny: wk(ny) && ny.min >= 480 && ny.min < 1020,
    fxOpen: fx.ok, fxName: fx.ok ? fx.name : fx.name, nextOpen: next || null,
  };
}

/* ── журнал (A9) ── */
type TradeDoc = { _id: Types.ObjectId; sym: string; play: string; dir: number; grade: string; entry: number; sl: number; tp1: number; tp2: number; risk: number; rr2: number; costR: number; takenAt: Date; outcome: { status: string; r?: number; net?: number; at?: Date; tp1?: boolean } };
export async function journal(user: string) {
  await dbConnect();
  const rows = await ScalpTrade.find({ user: new Types.ObjectId(user) }).sort({ takenAt: -1 }).limit(80).lean<TradeDoc[]>();
  for (const r of rows.filter((x) => x.outcome?.status === "open")) {
    const inst = bySym(r.sym);
    if (!inst) continue;
    const bars = closed(await liveM1(inst, 30_000).catch(() => []));
    const t0 = Math.floor(new Date(r.takenAt).getTime() / 60000) * 60000 + 60000;
    const start = bars.findIndex((x) => x.t >= t0);
    let out: TradeDoc["outcome"] | null = null;
    if (start >= 0) {
      const s = simulate(bars, start, r.dir, r, P.maxBars, true);
      if (s.status !== "open") out = { status: s.status, r: s.r, net: +(s.r - r.costR).toFixed(3), at: new Date(s.at), tp1: s.tp1 };
    } else if (bars.length && bars[0].t > t0) out = { status: "na", r: 0, net: 0, at: new Date() };
    if (out) { r.outcome = out; await ScalpTrade.updateOne({ _id: r._id }, { $set: { outcome: out, evaluatedAt: new Date() } }); }
  }
  const now = Date.now(), today = local(UB, now).day;
  const closedT = rows.filter((x) => !["open", "na"].includes(x.outcome?.status));
  const day = closedT.filter((x) => local(UB, new Date(x.takenAt).getTime()).day === today);
  const week = closedT.filter((x) => now - new Date(x.takenAt).getTime() < 7 * 864e5);
  let streak = 0;
  for (const x of day) { if ((x.outcome.net ?? 0) < 0) streak++; else break; }
  const dayR = +day.reduce((s, x) => s + (x.outcome.net ?? 0), 0).toFixed(2);
  const lastLoss = day.find((x) => (x.outcome.net ?? 0) < 0)?.outcome.at;
  const stop = dayR <= -3 ? "Өнөөдөр −3R хүрлээ. Өнөөдрийн арилжааг энд зогсоо — маргааш шинэ өдөр." :
    streak >= 3 && lastLoss && now - new Date(lastLoss).getTime() < 60 * 60e3 ? "Дараалсан 3 алдагдал. 1 цаг завсарла — уурласан үед хийсэн арилжаа хамгийн их алддаг." : "";
  const sum = (a: TradeDoc[]) => ({ n: a.length, win: a.filter((x) => (x.outcome.net ?? 0) > 0).length, r: +a.reduce((s, x) => s + (x.outcome.net ?? 0), 0).toFixed(2) });
  return {
    trades: rows.map((x) => ({ ...x, _id: String(x._id) })),
    today: { ...sum(day), streak, taken: rows.filter((x) => local(UB, new Date(x.takenAt).getTime()).day === today).length },
    week: sum(week), stop,
  };
}

export async function takeTrade(user: string, b: Record<string, unknown>) {
  const inst = bySym(String(b.sym));
  const n = (k: string) => Number(b[k]);
  const dir = n("dir") > 0 ? 1 : -1, entry = n("entry"), sl = n("sl"), tp1 = n("tp1"), tp2 = n("tp2");
  if (!inst || ![entry, sl, tp1, tp2].every((x) => Number.isFinite(x) && x > 0)) throw new Error("Буруу өгөгдөл");
  const risk = (entry - sl) * dir;
  if (!(risk > 0) || (tp1 - entry) * dir <= 0 || (tp2 - entry) * dir <= 0) throw new Error("SL/TP орох цэгийн буруу талд байна");
  await dbConnect();
  const j = await journal(user);
  if (j.stop) throw new Error(j.stop);
  if (j.today.taken >= 30) throw new Error("Өдөрт 30-аас олон скальп — хэт их арилжаа өөрөө эрсдэл");
  const play = PLAYS.includes(b.play as Play) ? String(b.play) : "manual";
  const doc = await ScalpTrade.create({
    user: new Types.ObjectId(user), sym: inst.sym, play, dir, grade: String(b.grade || "").slice(0, 4), entry, sl, tp1, tp2, risk,
    rr2: +((tp2 - entry) * dir / risk).toFixed(2), costR: +(inst.spread / risk).toFixed(3), takenAt: new Date(),
  });
  return String(doc._id);
}
export async function dropTrade(user: string, id: string) {
  await dbConnect();
  await ScalpTrade.deleteOne({ _id: id, user: new Types.ObjectId(user) });
}
