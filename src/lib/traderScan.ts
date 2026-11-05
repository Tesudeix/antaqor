import { candles, candlesSince, quoteToUsd, resolveSymbol, resolveTF, snapshot, TFS, TF_MIN, type Candle, type Inst, type Snapshot, type TF } from "@/lib/traderMarket";

/* ─── Tesla Trader · хөдөлгүүр (2026-10-25) ────────────────────────
   Мэргэжлийн трейдерийн дараалал — нэг эх сурвалжид итгэхгүй:
   1) AI (gpt-5.5 vision) зурагнаас ЗӨВХӨН баримт уншина: хос, хугацаа, бүтэц, түвшин, сүүлийн үнэ.
   2) Тухайн хосын БОДИТ лааг татаж индикаторыг өөрсдөө тооцно (EMA20/50/200, RSI, ATR, MACD, swing бүтэц).
   3) Тохирлын (confluence) оноо — тренд · бүтэц · момент · зургийн уншилт. Зөрчилдвөл «ХҮЛЭЭХ».
   4) SL = бүтцийн цаана + ATR буфер (1–3 ATR), TP1 = 1.5R, TP2 = 2.5R (эсэргүүцэл ойр бол тэнд).
   5) Итгэлцэл = оноо × тохирол × зургийн чанар × өгөгдлийн таарал — 88%-иас хэтрэхгүй (100% гэж байхгүй).
   6) Дараа нь бодит ханшаар TP/SL аль нь түрүүлж хүрснийг шалгаж, БОДИТ амжилтын хувийг гаргана. */

const MODEL = () => process.env.TRADER_MODEL || "gpt-5.5";

export type Read = {
  readable: boolean; quality: number; symbol: string; timeframe: string; lastPrice: number | null;
  priceHigh: number | null; priceLow: number | null; trend: "up" | "down" | "range"; structure: string;
  levels: { type: "support" | "resistance"; price: number; strength: number }[];
  patterns: string[]; indicators: string[]; bias: "buy" | "sell" | "neutral"; biasStrength: number; reasons: string[]; notes: string;
  /** Үнийн тэнхлэгийн шошго — зургийн өндрийн хувиар (0 дээд, 1 доод). SL/TP шугамыг зурган дээр зурахад */
  axis: { price: number; y: number }[];
};
/** Үнэ → зургийн босоо байрлал (0..1): y = a·price + b. Тэнхлэг найдвартай уншигдсан үед л. */
export type Overlay = { a: number; b: number } | null;
/** Ижил төстэй өмнөх тохиолдлууд (backtest + бодит скан) — итгэлцлийг бодит статистикаар тохируулна */
export type History = { n: number; win: number; loss: number; winRate: number; avgR: number; live: number };
export type Factor = { key: string; label: string; value: number; text: string };
export type Decision = { dir: "BUY" | "SELL" | "WAIT"; score: number; confidence: number; grade: "A" | "B" | "C" | "—"; factors: Factor[]; agree: number };
export type Levels = { entry: number; sl: number; tp1: number; tp2: number; risk: number; rr1: number; rr2: number; slPips: number; tp1Pips: number; tp2Pips: number;
  /** Үнэ эсрэг түвшинд наалдсан / хэт сунасан үед — буцалт хүлээж орох (limit) илүү сайн цэг */
  limit: number | null };

/* 2026-11-04: OpenAI-ийн хоёр түлхүүр кредитгүй болсон тул төлбөр/квотын алдаа гарвал 10 мин
   Gemini (OpenAI-нийцтэй endpoint, зураг data URL дэмждэг) руу шилжинэ. */
let openaiDownUntil = 0;
async function openai(body: Record<string, unknown>): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  let last = "";
  if (key && Date.now() > openaiDownUntil) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120_000),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return String(d?.choices?.[0]?.message?.content || "");
    last = `AI алдаа: ${String(d?.error?.message || r.status).slice(0, 160)}`;
    if (!/ 40[123]| 429|credit|quota|billing/i.test(` ${r.status} ${last}`)) throw new Error(last);
    openaiDownUntil = Date.now() + 10 * 60e3;
  }
  const g = process.env.GEMINI_API_KEY;
  if (!g) throw new Error(last || "AI тохируулаагүй");
  const { model: _m, max_completion_tokens, reasoning_effort: _e, ...rest } = body;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${g}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...rest, model: process.env.TRADER_GEMINI_MODEL || "gemini-3-flash-preview", max_tokens: max_completion_tokens, reasoning_effort: "low" }),
    signal: AbortSignal.timeout(120_000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`AI алдаа: ${String((Array.isArray(d) ? d[0] : d)?.error?.message || r.status).slice(0, 160)}`);
  return String(d?.choices?.[0]?.message?.content || "");
}
function json<T>(raw: string, fb: T): T {
  try { return JSON.parse(raw) as T; } catch { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]) as T; } catch { /* доош */ } } return fb; }
}
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : typeof x === "string" && x.trim() && Number.isFinite(Number(x.replace(/[ ,]/g, ""))) ? Number(x.replace(/[ ,]/g, "")) : null);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/* ── 1. Зураг унших — баримт л, таамаг зохиохгүй ── */
export async function readChart(dataUrl: string, hint: { symbol?: string; tf?: string }): Promise<Read> {
  const text = `You are a senior FX/CFD chart analyst. Read this trading-chart screenshot and extract FACTS only. Never invent values: if something is not clearly visible, use null or "".
${hint.symbol ? `The user says the instrument is ${hint.symbol}.` : ""}${hint.tf ? ` The user says the timeframe is ${hint.tf}.` : ""}
Read prices from the price axis / last-price label exactly as printed (decimal point, all digits).
Write every free-text field (structure, patterns, indicators, reasons, notes) in MONGOLIAN Cyrillic; keep codes and terms like EURUSD, EMA, RSI, HH/HL in English.
Return JSON only:
{"readable":true|false,"quality":0..1 (how clearly candles+price axis can be read),
"symbol":"instrument as printed, e.g. EURUSD, XAUUSD, GBPJPY, US30, BTCUSD or \\"\\"",
"timeframe":"M1|M5|M15|M30|H1|H4|D1|W1 or \\"\\"",
"lastPrice":number|null,"priceHigh":number|null (highest price on the visible axis),"priceLow":number|null,
"trend":"up|down|range","structure":"1 short sentence about swing structure (HH/HL, LH/LL, range, break of structure)",
"levels":[{"type":"support|resistance","price":number,"strength":1..3}] (max 6, only levels you can actually locate),
"patterns":["chart/candle patterns clearly present, e.g. double top, bull flag, pin bar at support"],
"indicators":["visible indicators and their reading, e.g. RSI 68 rising, price above EMA 200"],
"bias":"buy|sell|neutral","biasStrength":0..1,"reasons":["2-5 short reasons for the bias, technical only"],
"notes":"anything the trader drew on the chart (lines, zones, arrows) or warnings, short",
"axis":[{"price":number,"y":0..1}] (3-5 price labels printed on the right price axis, y = vertical position of the label's centre as a fraction of the FULL image height, 0 = top edge, 1 = bottom edge; [] if no axis)}`;
  const raw = await openai({
    model: MODEL(), reasoning_effort: "medium", max_completion_tokens: 6000, response_format: { type: "json_object" },
    messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] }],
  });
  const j = json<Record<string, unknown>>(raw, {});
  const lv = Array.isArray(j.levels) ? (j.levels as Record<string, unknown>[]) : [];
  return {
    readable: j.readable !== false, quality: clamp(Number(j.quality) || 0, 0, 1),
    symbol: String(j.symbol || ""), timeframe: String(j.timeframe || ""),
    lastPrice: num(j.lastPrice), priceHigh: num(j.priceHigh), priceLow: num(j.priceLow),
    trend: (["up", "down", "range"].includes(String(j.trend)) ? j.trend : "range") as Read["trend"], structure: String(j.structure || "").slice(0, 300),
    levels: lv.map((x) => ({ type: (x.type === "resistance" ? "resistance" : "support") as "support" | "resistance", price: num(x.price) ?? NaN, strength: clamp(Number(x.strength) || 1, 1, 3) })).filter((x) => Number.isFinite(x.price)).slice(0, 6),
    patterns: (Array.isArray(j.patterns) ? j.patterns : []).map(String).slice(0, 6),
    indicators: (Array.isArray(j.indicators) ? j.indicators : []).map(String).slice(0, 6),
    bias: (["buy", "sell"].includes(String(j.bias)) ? j.bias : "neutral") as Read["bias"], biasStrength: clamp(Number(j.biasStrength) || 0, 0, 1),
    reasons: (Array.isArray(j.reasons) ? j.reasons : []).map(String).slice(0, 5), notes: String(j.notes || "").slice(0, 300),
    axis: (Array.isArray(j.axis) ? (j.axis as Record<string, unknown>[]) : []).map((x) => ({ price: num(x.price) ?? NaN, y: Number(x.y) })).filter((x) => Number.isFinite(x.price) && x.y >= 0 && x.y <= 1).slice(0, 6),
  };
}

/** Тэнхлэгийн шошгоноос үнэ→y шугаман хамаарал. Буруу/зөрчилтэй бол null (шугам зурахгүй). */
export function overlayOf(read: Read): Overlay {
  const p = read.axis;
  if (p.length < 2) return null;
  const n = p.length, mx = p.reduce((s, q) => s + q.price, 0) / n, my = p.reduce((s, q) => s + q.y, 0) / n;
  const sxx = p.reduce((s, q) => s + (q.price - mx) ** 2, 0);
  if (!sxx) return null;
  const a = p.reduce((s, q) => s + (q.price - mx) * (q.y - my), 0) / sxx, b = my - a * mx;
  if (a >= 0) return null;                                         /* өндөр үнэ дээр байх ёстой */
  const resid = Math.max(...p.map((q) => Math.abs(a * q.price + b - q.y)));
  if (resid > 0.03) return null;
  if (read.lastPrice != null) { const y = a * read.lastPrice + b; if (y < -0.05 || y > 1.05) return null; }
  return { a, b };
}

/* ── онцлог вектор (арилжааны чиглэлд тэгшилсэн) — kNN-ээр түүхэн тохиолдол хайх ──
   0 тренд · 1 бүтэц · 2 момент · 3 эсрэг түвшин хүртэлх зай · 4 RSI · 5 EMA20-оос сунасан ·
   6 limit · 7 EMA200-ийн тал · 8 хугацаа · 9 хэрэгслийн төрөл. Зургийн уншилт ОРОХГҮЙ (backtest-д байхгүй). */
const KIND_IX: Record<string, number> = { fx: 0, metal: 0.34, index: 0.67, crypto: 1 };
export function features(dir: "BUY" | "SELL", s: Snapshot, lv: Levels, f: Factor[], tf: TF, kind: string): number[] {
  const sg = dir === "BUY" ? 1 : -1, val = (k: string) => f.find((x) => x.key === k)?.value || 0;
  const opp = dir === "BUY" ? s.resistance[0] : s.support[0];
  const room = opp ? clamp(Math.abs(opp - s.price) / s.atr, 0, 3) / 3 : 1;
  return [
    val("trend") * sg, val("structure") * sg, clamp(val("momentum"), -1, 1) * sg, room,
    clamp(((s.rsi - 50) / 50) * sg, -1, 1), clamp(((s.price - s.ema20) * sg) / s.atr, -3, 3) / 3,
    lv.limit ? 1 : 0, Math.sign(s.price - s.ema200) * sg, TFS.indexOf(tf) / (TFS.length - 1), KIND_IX[kind] ?? 0,
  ].map((x) => +x.toFixed(3));
}

/* ── 3. Тохирлын оноо ── */
export function decide(read: Read, s: Snapshot | null, inst: Inst | null): { decision: Decision; warnings: string[] } {
  const warnings: string[] = [];
  const f: Factor[] = [];
  const fmt = (x: number) => (inst ? x.toFixed(inst.digits) : String(+x.toPrecision(6)));
  if (s) {
    const p = s.price;
    const trend = p > s.ema50 && s.ema50 > s.ema200 ? 1 : p < s.ema50 && s.ema50 < s.ema200 ? -1 : p > s.ema200 ? 0.35 : -0.35;
    f.push({ key: "trend", label: "Тренд (EMA 50/200)", value: trend, text: `Үнэ ${fmt(p)} · EMA50 ${fmt(s.ema50)} · EMA200 ${fmt(s.ema200)}` });
    const st = s.structure === "up" ? 1 : s.structure === "down" ? -1 : 0;
    f.push({ key: "structure", label: "Бүтэц (swing)", value: st, text: s.structure === "up" ? "Өндөр оргил, өндөр ёроол (HH/HL)" : s.structure === "down" ? "Нам оргил, нам ёроол (LH/LL)" : "Хажуу тийш (range)" });
    const r = s.rsi > 55 ? 0.5 : s.rsi < 45 ? -0.5 : 0;
    const m = s.macdHist > 0 && s.macdHist >= s.macdPrev ? 0.5 : s.macdHist < 0 && s.macdHist <= s.macdPrev ? -0.5 : s.macdHist > 0 ? 0.2 : -0.2;
    f.push({ key: "momentum", label: "Момент (RSI, MACD)", value: r + m, text: `RSI ${s.rsi.toFixed(0)} · MACD ${s.macdHist >= 0 ? "эерэг" : "сөрөг"}, ${Math.abs(s.macdHist) >= Math.abs(s.macdPrev) ? "хүчтэй болж" : "сулрч"} байна` });
  } else {
    warnings.push("Энэ хэрэгслийн бодит ханш олдсонгүй — шийдвэр зөвхөн зургийн уншилтад тулгуурласан тул итгэлцэл бага.");
  }
  const v = read.bias === "buy" ? read.biasStrength : read.bias === "sell" ? -read.biasStrength : 0;
  f.push({ key: "chart", label: "Зургийн уншилт (AI)", value: v, text: read.structure || (read.bias === "neutral" ? "Тодорхой чиглэл алга" : read.bias === "buy" ? "Өсөх хандлага" : "Унах хандлага") });

  const W: Record<string, number> = s ? { trend: 0.3, structure: 0.25, momentum: 0.2, chart: 0.25 } : { chart: 1 };
  let score = f.reduce((a, x) => a + x.value * (W[x.key] || 0), 0);
  let dir: Decision["dir"] = score > 0.18 ? "BUY" : score < -0.18 ? "SELL" : "WAIT";
  const sign = dir === "BUY" ? 1 : dir === "SELL" ? -1 : 0;
  const agree = f.filter((x) => Math.sign(x.value) === sign && Math.abs(x.value) >= 0.2).length;
  const against = f.filter((x) => Math.sign(x.value) === -sign && Math.abs(x.value) >= 0.2).length;

  let conf = dir === "WAIT" ? 0 : 48 + Math.abs(score) * 42 + agree * 3 - against * 6;
  let cap = 85;
  if (s && dir !== "WAIT") {
    /* байршил: эсэргүүцэл рүү худалдан авах, дэмжлэг рүү зарахыг шийтгэнэ — мэргэжлийн трейдер тэнд хөөцөлдөж ордоггүй */
    const near = dir === "BUY" ? s.resistance[0] : s.support[0];
    if (near && Math.abs(near - s.price) < s.atr * 0.6) { conf -= 12; cap = 70; warnings.push(dir === "BUY" ? `Үнэ эсэргүүцэл (${fmt(near)})-д тулж байна — одоо шууд авахаас илүү эвдэрч гарах эсвэл буцалтыг хүлээ.` : `Үнэ дэмжлэг (${fmt(near)})-д тулж байна — одоо шууд зарахаас илүү эвдэрч гарах эсвэл буцалтыг хүлээ.`); }
    if ((dir === "BUY" && s.rsi > 70) || (dir === "SELL" && s.rsi < 30)) { conf -= 10; cap = Math.min(cap, 72); warnings.push(`RSI ${s.rsi.toFixed(0)} — хэт ${dir === "BUY" ? "худалдан авагдсан" : "зарагдсан"}, буцаж засрах магадлалтай.`); }
    if (Math.abs(s.price - s.ema20) > s.atr * 2) { conf -= 6; warnings.push("Үнэ EMA20-оос хол сунасан — хөөцөлдөж орохоос илүү буцалтыг хүлээ."); }
    f.push({ key: "location", label: "Байршил (түвшин)", value: near && Math.abs(near - s.price) < s.atr * 0.6 ? -0.5 * sign : 0.5 * sign, text: dir === "BUY" ? `Ойрын эсэргүүцэл ${s.resistance[0] ? fmt(s.resistance[0]) : "—"} · дэмжлэг ${s.support[0] ? fmt(s.support[0]) : "—"}` : `Ойрын дэмжлэг ${s.support[0] ? fmt(s.support[0]) : "—"} · эсэргүүцэл ${s.resistance[0] ? fmt(s.resistance[0]) : "—"}` });
  }
  /* зураг ба бодит ханш таарч байна уу */
  if (s && read.lastPrice) {
    const gap = Math.abs(read.lastPrice - s.price);
    if (gap > s.atr * 2.5) { conf -= 15; warnings.push(`Зураг дээрх үнэ (${fmt(read.lastPrice)}) одоогийн бодит ханшаас (${fmt(s.price)}) их зөрж байна — хуучин зураг эсвэл өөр хос байж магадгүй. Шинэ зураг оруулбал илүү найдвартай.`); }
  }
  if (!read.readable || read.quality < 0.4) { conf -= 12; warnings.push("Зураг бүдэг эсвэл үнийн тэнхлэг тод харагдахгүй байна — илүү том, тод screenshot оруулна уу."); }
  if (!s) conf = Math.min(conf, 55);
  conf = dir === "WAIT" ? 0 : clamp(Math.round(conf), 35, cap);
  if (dir !== "WAIT" && conf < 45) { dir = "WAIT"; conf = 0; warnings.push("Тохирол сул тул арилжаа санал болгохгүй — дараагийн боломжийг хүлээ."); }
  if (dir === "WAIT") score = Math.round(score * 100) / 100;
  const grade: Decision["grade"] = dir === "WAIT" ? "—" : conf >= 72 ? "A" : conf >= 60 ? "B" : "C";
  return { decision: { dir, score: Math.round(score * 100) / 100, confidence: conf, grade, factors: f, agree }, warnings };
}

/* ── 4. SL / TP ──
   Үнэ эсрэг түвшинд тулсан / EMA20-оос хол сунасан / RSI туйлд байвал мэргэжлийн трейдер хөөцөлдөхгүй —
   буцалтыг хүлээж LIMIT-ээр орно. Тэр үед SL/TP-г limit цэгээс тооцно. */
export function levels(dir: "BUY" | "SELL", s: Snapshot, inst: Inst): Levels {
  const p = s.price, a = s.atr, sg = dir === "BUY" ? 1 : -1;
  const r = (x: number) => +x.toFixed(inst.digits);
  const opp = dir === "BUY" ? s.resistance[0] : s.support[0];
  const stretched = (opp && Math.abs(opp - p) < a * 0.6) || Math.abs(p - s.ema20) > a * 2 || (dir === "BUY" ? s.rsi > 70 : s.rsi < 30);
  let e = p, limit: number | null = null;
  if (stretched) {
    const back = dir === "BUY" ? Math.min(s.ema20, p - a * 0.8) : Math.max(s.ema20, p + a * 0.8);
    if (Math.abs(back - p) <= a * 2.5) { e = back; limit = r(back); }
  }
  const swing = dir === "BUY" ? Math.min(...(s.lastLows.length ? s.lastLows.slice(-2) : [e - a])) : Math.max(...(s.lastHighs.length ? s.lastHighs.slice(-2) : [e + a]));
  let slDist = Math.abs(e - swing) + a * 0.2;
  if (!Number.isFinite(slDist) || (dir === "BUY" ? swing >= e : swing <= e)) slDist = a * 1.5;
  slDist = clamp(slDist, a * 1.0, a * 3.0);
  const sl = e - sg * slDist;
  let tp1 = e + sg * slDist * 1.5;
  const tp2 = e + sg * slDist * 2.5;
  /* TP1-ийн өмнө хүчтэй түвшин байвал (≥1R зайтай) түүний өмнө авна */
  const wall = dir === "BUY" ? s.resistance.find((x) => x > e + slDist && x < tp1) : s.support.find((x) => x < e - slDist && x > tp1);
  if (wall) tp1 = wall - sg * a * 0.1;
  const pips = (x: number) => Math.round(Math.abs(x - e) / inst.pip);
  return { entry: r(e), sl: r(sl), tp1: r(tp1), tp2: r(tp2), risk: r(slDist), rr1: +(Math.abs(tp1 - e) / slDist).toFixed(2), rr2: +(Math.abs(tp2 - e) / slDist).toFixed(2), slPips: pips(sl), tp1Pips: pips(tp1), tp2Pips: pips(tp2), limit };
}

/* ── 5. Монгол тайлбар — тоог AI өөрчлөхгүй ── */
export async function explain(o: { symbol: string; tf: string; decision: Decision; lv: Levels | null; read: Read; snap: Snapshot | null; warnings: string[]; hist?: History | null }) {
  const facts = {
    instrument: o.symbol, timeframe: o.tf, direction: o.decision.dir, confidence: o.decision.confidence,
    factors: o.decision.factors.map((f) => ({ name: f.label, value: f.value, detail: f.text })),
    levels: o.lv, chart_read: { structure: o.read.structure, patterns: o.read.patterns, indicators: o.read.indicators, reasons: o.read.reasons, drawn: o.read.notes, levels: o.read.levels },
    live: o.snap ? { price: o.snap.price, rsi: +o.snap.rsi.toFixed(1), atr: o.snap.atr, ema50: o.snap.ema50, ema200: o.snap.ema200, support: o.snap.support, resistance: o.snap.resistance } : null,
    warnings: o.warnings,
    similar_past_setups: o.hist && o.hist.n >= 15 ? { count: o.hist.n, reached_tp_percent: o.hist.winRate, avg_R: o.hist.avgR } : null,
  };
  const raw = await openai({
    model: MODEL(), reasoning_effort: "low", max_completion_tokens: 2500, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a 20-year professional FX trader writing a clear trade note in MONGOLIAN (Cyrillic) for a retail trader. Use ONLY the numbers given — never invent or change prices, levels or percentages. Plain words, short sentences. If similar_past_setups is given, mention it in one reason (e.g. «ижил төстэй N тохиолдлын X% нь TP-д хүрсэн»). Trading terms (BUY, SELL, SL, TP, EMA, RSI) may stay in English. Never promise profit. If levels.limit is set, the plan is a LIMIT order at levels.entry (wait for the pullback) — say clearly not to chase the current price. If direction is WAIT, explain what to wait for and do not give entry prices." },
      { role: "user", content: `Analysis facts (JSON):\n${JSON.stringify(facts)}\n\nReturn JSON: {"summary":"1-2 sentences: the setup and the decision","reasons":["3-5 bullet reasons that support the decision, each grounded in a fact"],"invalidation":"1 sentence: what price action would cancel this idea (use the SL level)","plan":"1-2 sentences: how to manage it (entry, move SL to breakeven at TP1, etc.) — if WAIT: what to wait for","risk":"1 sentence risk reminder specific to this setup"}` },
    ],
  });
  const j = json<Record<string, unknown>>(raw, {});
  return {
    summary: String(j.summary || ""), reasons: (Array.isArray(j.reasons) ? j.reasons : []).map(String).slice(0, 5),
    invalidation: String(j.invalidation || ""), plan: String(j.plan || ""), risk: String(j.risk || ""),
  };
}

/* ── бүтэн дараалал ──
   recall: онцлог векторт хамгийн ойр өмнөх тохиолдлуудыг буцаана (lib/traderLearn.ts). 15+ олдвол
   итгэлцлийг бодит TP хүрсэн хувьтай холино — «AI-ийн мэдрэмж» биш, өгөгдөл шийднэ. */
export async function scanChart(dataUrl: string, hint: { symbol?: string; tf?: string }, recall?: (feat: number[]) => Promise<History | null>) {
  const read = await readChart(dataUrl, hint);
  if (!read.readable && read.quality < 0.15) throw new Error("Зурагнаас график олдсонгүй. Форекс графикийн screenshot оруулна уу (үнийн тэнхлэг харагдаж байх).");
  const inst = resolveSymbol(hint.symbol || read.symbol);
  const tf: TF = resolveTF(hint.tf || read.timeframe) || "H1";
  let snap: Snapshot | null = null, quoteUsd = 0, dataNote = "";
  if (inst) {
    try {
      const d = await candles(inst, tf);
      snap = snapshot(d.candles, d.price, d.time, tf);
      quoteUsd = await quoteToUsd(inst.quote).catch(() => 0);
      if (Date.now() - d.time > 3 * 864e5) dataNote = "Зах зээл хаалттай (амралтын өдөр) — сүүлийн хаалтын ханшаар тооцов.";
    } catch (e) { dataNote = `Бодит ханш татаж чадсангүй: ${(e as Error).message}`; }
  }
  const { decision, warnings } = decide(read, snap, inst);
  if (!inst) warnings.unshift("Хос танигдсангүй — дээрээс хосоо сонгоод дахин сканнердвал бодит ханштай тулгана.");
  if (dataNote) warnings.push(dataNote);
  if (inst?.note) warnings.push(inst.note);
  if (!hint.tf && !resolveTF(read.timeframe)) warnings.push("Хугацаа (timeframe) зурагнаас танигдсангүй — H1 гэж тооцов. Дээрээс сонгож болно.");
  let lv = decision.dir !== "WAIT" && snap && inst ? levels(decision.dir, snap, inst) : null;
  let feat: number[] = [], hist: History | null = null;
  if (lv && snap && inst && decision.dir !== "WAIT") {
    feat = features(decision.dir, snap, lv, decision.factors, tf, inst.kind);
    hist = recall ? await recall(feat).catch(() => null) : null;
    if (hist && hist.n >= 15) {
      const blended = Math.round(decision.confidence * 0.6 + hist.winRate * 0.4);
      decision.confidence = clamp(blended, 35, 85);
      if (hist.avgR < 0) warnings.push(`Ийм нөхцөлд өмнө нь ${hist.n} тохиолдлоос ${hist.winRate}% нь TP-д хүрч, дунджаар ${hist.avgR}R алдагдалтай байсан — болгоомжтой.`);
      else if (hist.winRate < 40) warnings.push(`Ийм нөхцөлд өмнө нь ${hist.n} тохиолдлоос ${hist.winRate}% нь TP-д хүрсэн (дундаж +${hist.avgR}R) — ялагдал олон, SL-ээ заавал барь.`);
      if (decision.confidence < 45) { warnings.push("Түүхэн статистик сул тул арилжаа санал болгохгүй."); decision.dir = "WAIT"; decision.confidence = 0; decision.grade = "—"; lv = null; }
      else decision.grade = decision.confidence >= 72 ? "A" : decision.confidence >= 60 ? "B" : "C";
    }
  }
  const text = await explain({ symbol: inst?.symbol || read.symbol || "?", tf, decision, lv, read, snap, warnings, hist }).catch(() => ({ summary: "", reasons: read.reasons, invalidation: "", plan: "", risk: "" }));
  return { read, inst, tf, snap, decision, levels: lv, warnings, text, quoteUsd, feat, hist, overlay: overlayOf(read) };
}

/* ── 6. Үр дүн: TP/SL аль нь түрүүлсэн — бодит скан болон backtest НЭГ дүрмээр ── */
export type Outcome = { status: "open" | "pending" | "tp1" | "tp2" | "sl" | "expired" | "nofill" | "na"; at?: Date; price?: number; r?: number };
export function simulate(L: Levels, dir: string, cs: Candle[], o: { maxBars?: number; expired?: boolean } = {}): Outcome {
  const buy = dir === "BUY";
  let filled = !L.limit, hitTp1: Candle | null = null, bars = 0;
  for (const c of cs) {
    if (o.maxBars && ++bars > o.maxBars) break;
    if (!filled) {
      /* LIMIT: эхлээд орох цэгт хүрэх ёстой; түүнээс өмнө TP1 руу явчихвал арилжаа болоогүй */
      if (buy ? c.l <= L.entry : c.h >= L.entry) filled = true;
      else if (buy ? c.h >= L.tp1 : c.l <= L.tp1) return { status: "nofill", at: new Date(c.t) };
      else continue;
    }
    const slHit = buy ? c.l <= L.sl : c.h >= L.sl;
    const tp1 = buy ? c.h >= L.tp1 : c.l <= L.tp1;
    const tp2 = buy ? c.h >= L.tp2 : c.l <= L.tp2;
    if (!hitTp1) {
      if (slHit) return { status: "sl", at: new Date(c.t), price: L.sl, r: -1 };   /* нэг лаанд хоёулаа бол SL гэж тооцно (болгоомжтой) */
      if (tp2) return { status: "tp2", at: new Date(c.t), price: L.tp2, r: L.rr2 };
      if (tp1) hitTp1 = c;
    } else {
      if (tp2) return { status: "tp2", at: new Date(c.t), price: L.tp2, r: L.rr2 };
      if (buy ? c.l <= L.entry : c.h >= L.entry) return { status: "tp1", at: new Date(hitTp1.t), price: L.tp1, r: L.rr1 };   /* TP1-ийн дараа SL-ээ entry рүү */
    }
  }
  if (hitTp1) return { status: "tp1", at: new Date(hitTp1.t), price: L.tp1, r: L.rr1 };
  const done = o.expired || (o.maxBars ? bars > o.maxBars : false);
  if (done) {
    if (!filled) return { status: "nofill" };
    const last = cs.at(-1)?.c ?? L.entry;
    return { status: "expired", price: last, r: +(((last - L.entry) * (buy ? 1 : -1)) / L.risk).toFixed(2) };
  }
  return { status: filled ? "open" : "pending" };
}
export async function evaluate(x: { symbol: string; tf: string; dir: string; createdAt: Date; levels: Levels | null }): Promise<Outcome> {
  if (x.dir === "WAIT" || !x.levels) return { status: "na" };
  const inst = resolveSymbol(x.symbol);
  if (!inst) return { status: "na" };
  const tf = (resolveTF(x.tf) || "H1") as TF;
  const since = new Date(x.createdAt).getTime();
  const cs = await candlesSince(inst, since);
  /* 60 лааны дотор шийдэгдэхгүй бол хугацаа дууссан */
  const out = simulate(x.levels, x.dir, cs, { expired: Date.now() - since > TF_MIN[tf] * 60e3 * 60 });
  return out.status === "expired" || out.status === "nofill" ? { ...out, at: out.at || new Date() } : out;
}
