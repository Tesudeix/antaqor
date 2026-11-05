import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { embedMany, embedQuery } from "@/lib/embeddings";
import { TraderSample, TraderMemory, TraderMsg } from "@/models/TraderBrain";
import { TraderScan } from "@/models/TraderScan";
import { candles, resolveSymbol, snapshot, type TF } from "@/lib/traderMarket";
import { decide, features, levels, simulate, type History, type Levels, type Read } from "@/lib/traderScan";

/* ─── Tesla Trader AI · суралцах (2026-10-25) ────────────────────────────────────────
   1) BACKTEST — 10 хос × 4 хугацааны бодит түүхэн лаан дээр яг ижил шийдвэр/SL/TP дүрмийг
      гүйлгэж (зургийн уншилтгүй), үр дүнг TraderSample-д хадгална → эхний өдрөөс статистиктай.
   2) LIVE — хэрэглэгчийн скан хаагдахад (TP/SL) түүний вектор + үр дүнг нэмнэ, нийтийн
      «сургамж» текст санах ой үүсгэнэ. Систем ашиглах тусам өөрийн бодит өгөгдлөөр сурна.
   3) ЧАТ — асуулт бүрт хамгийн ойр санах ойг (сонголт, өмнөх чат, сургамж) embedding-ээр сэргээж
      хариулна; хэрэглэгчийн байнгын мэдээллийг (данс, эрсдэл, брокер, session…) ялгаж хадгална.
   Энэ нь загварыг fine-tune хийх биш — өгөгдлөөс хайж (retrieval) статистик тооцох «санах ой». */

const BT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY", "AUDUSD", "USDCAD", "EURJPY", "BTCUSD", "NAS100"];
const BT_TFS: TF[] = ["M15", "H1", "H4", "D1"];
const NEUTRAL: Read = { readable: true, quality: 1, symbol: "", timeframe: "", lastPrice: null, priceHigh: null, priceLow: null, trend: "range", structure: "", levels: [], patterns: [], indicators: [], bias: "neutral", biasStrength: 0, reasons: [], notes: "", axis: [] };
const W = [1.2, 1, 1, 0.8, 0.8, 0.8, 0.6, 0.8, 0.5, 0.5];

/** Түүхэн лаан дээр дүрмээ гүйлгэнэ. Өмнөх backtest-ийг солино (давхардахгүй). */
export async function backtest(o: { step?: number; log?: (m: string) => void } = {}) {
  await dbConnect();
  const step = o.step || 3;
  const rows: Record<string, unknown>[] = [];
  for (const sym of BT_SYMBOLS) {
    const inst = resolveSymbol(sym)!;
    for (const tf of BT_TFS) {
      try {
        const d = await candles(inst, tf);
        const cs = d.candles;
        let n = 0;
        for (let i = 220; i < cs.length - 5; i += step) {
          const hist = cs.slice(0, i), last = hist[hist.length - 1];
          const s = snapshot(hist, last.c, last.t, tf);
          const { decision } = decide(NEUTRAL, s, inst);
          if (decision.dir === "WAIT") continue;
          const lv = levels(decision.dir, s, inst);
          const out = simulate(lv, decision.dir, cs.slice(i), { maxBars: 60 });
          if (out.status === "open" || out.status === "pending") continue;   /* ирээдүйн өгөгдөл хүрэлцээгүй */
          rows.push({ feat: features(decision.dir, s, lv, decision.factors, tf, inst.kind), dir: decision.dir, status: out.status, r: out.r ?? 0, symbol: inst.symbol, tf, kind: inst.kind, source: "backtest", t: new Date(last.t) });
          n++;
        }
        o.log?.(`${sym} ${tf}: ${n}`);
      } catch (e) { o.log?.(`${sym} ${tf}: алдаа ${(e as Error).message}`); }
    }
  }
  if (rows.length < 50) throw new Error(`Backtest хангалтгүй (${rows.length})`);
  await TraderSample.deleteMany({ source: "backtest" });
  await TraderSample.insertMany(rows, { ordered: false });
  pool = null;
  return { total: rows.length };
}

/* ── kNN: хамгийн ойр 50 хаагдсан тохиолдол (30-аас тогтвортой: ±7%) ── */
type P = { feat: number[]; status: string; r: number; source: string };
let pool: { at: number; rows: P[] } | null = null;
async function samples(): Promise<P[]> {
  if (pool && Date.now() - pool.at < 10 * 60e3) return pool.rows;
  await dbConnect();
  const rows = await TraderSample.find({ status: { $in: ["tp1", "tp2", "sl"] } }).select("feat status r source").sort({ t: -1 }).limit(30000).lean<P[]>();
  pool = { at: Date.now(), rows };
  return rows;
}
export async function recall(feat: number[], k = 50): Promise<History | null> {
  const rows = await samples();
  if (rows.length < k) return null;
  const d = (a: number[]) => Math.sqrt(a.reduce((s, x, i) => s + W[i] * (x - (feat[i] ?? 0)) ** 2, 0));
  const near = rows.map((x) => ({ x, dist: d(x.feat) })).sort((a, b) => a.dist - b.dist).slice(0, k);
  if (near.reduce((s, q) => s + q.dist, 0) / near.length > 1.2) return null;   /* хангалттай төстэй тохиолдол алга */
  const win = near.filter((q) => q.x.status !== "sl").length, loss = near.length - win;
  return { n: near.length, win, loss, winRate: Math.round((win / near.length) * 100), avgR: +(near.reduce((s, q) => s + (q.x.r || 0), 0) / near.length).toFixed(2), live: near.filter((q) => q.x.source === "live").length };
}
export async function sampleStats() {
  await dbConnect();
  const [bt, live, last] = await Promise.all([
    TraderSample.countDocuments({ source: "backtest" }), TraderSample.countDocuments({ source: "live" }),
    TraderSample.findOne({ source: "backtest" }).sort({ createdAt: -1 }).select("createdAt").lean<{ createdAt: Date }>(),
  ]);
  return { backtest: bt, live, seededAt: last?.createdAt || null };
}
/** 7 хоногт нэг удаа backtest-ийг шинэчилнэ (хуудас нээгдэхэд арын ажлаар; давхар эхлэхгүй) */
let seeding = false;
export function maybeReseed() {
  if (seeding) return;
  seeding = true;
  sampleStats().then((s) => (!s.seededAt || Date.now() - +new Date(s.seededAt) > 7 * 864e5 ? backtest() : null))
    .catch((e) => console.error("[trader backtest]", (e as Error).message)).finally(() => { seeding = false; });
}

/* ── хаагдсан скан → суралцах ── */
export async function learnFromScan(scanId: string) {
  const x = await TraderScan.findById(scanId).lean<{ _id: Types.ObjectId; symbol: string; tf: string; kind: string; feat: number[]; decision: { dir: string; factors?: { label: string; text: string }[] }; outcome: { status: string; r?: number }; levels: Levels | null; read: { patterns?: string[] } }>();
  if (!x || !x.feat?.length || !["tp1", "tp2", "sl", "expired", "nofill"].includes(x.outcome?.status)) return;
  if (["tp1", "tp2", "sl"].includes(x.outcome.status)) {
    await TraderSample.updateOne({ scan: x._id }, { $setOnInsert: { feat: x.feat, dir: x.decision.dir, status: x.outcome.status, r: x.outcome.r ?? 0, symbol: x.symbol, tf: x.tf, kind: x.kind, source: "live", scan: x._id, t: new Date() } }, { upsert: true });
    pool = null;
  }
  const res = { tp1: "TP1 хүрсэн", tp2: "TP2 хүрсэн", sl: "SL хүрсэн", expired: "хугацаа дууссан", nofill: "limit-д хүрээгүй" }[x.outcome.status as "tp1"];
  const why = (x.decision.factors || []).map((f) => `${f.label}: ${f.text}`).join("; ");
  const text = `${x.symbol} ${x.tf} ${x.decision.dir}${x.levels?.limit ? " LIMIT" : ""} → ${res}${x.outcome.r != null ? ` (${x.outcome.r > 0 ? "+" : ""}${x.outcome.r}R)` : ""}. Нөхцөл: ${why}${x.read?.patterns?.length ? `; загвар: ${x.read.patterns.join(", ")}` : ""}`;
  await addMemory(null, "lesson", text, { scan: String(x._id), symbol: x.symbol, tf: x.tf, status: x.outcome.status });
}

/* ── текст санах ой ── */
const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] || 0), 0);
export async function addMemory(user: string | null, kind: "pref" | "chat" | "lesson" | "feedback", text: string, meta: Record<string, unknown> = {}) {
  await dbConnect();
  const [emb] = await embedMany([text]);
  /* бараг ижил санах ой байвал шинэчилнэ (давхардуулахгүй) */
  const same = await TraderMemory.find({ user: user ? new Types.ObjectId(user) : null, kind }).sort({ updatedAt: -1 }).limit(300).select("emb").lean<{ _id: Types.ObjectId; emb: number[] }[]>();
  const hit = same.find((m) => cos(m.emb, emb) > (kind === "pref" ? 0.9 : 0.97));
  if (hit) { await TraderMemory.updateOne({ _id: hit._id }, { $set: { text: text.slice(0, 1200), emb, meta } }); return { updated: true }; }
  await TraderMemory.create({ user: user ? new Types.ObjectId(user) : null, kind, text: text.slice(0, 1200), emb, meta });
  return { updated: false };
}
export async function recallMemory(user: string, q: string, k = 6) {
  await dbConnect();
  const v = await embedQuery(q);
  const rows = await TraderMemory.find({ $or: [{ user: new Types.ObjectId(user) }, { user: null, kind: "lesson" }] }).sort({ updatedAt: -1 }).limit(3000).select("kind text emb user").lean<{ kind: string; text: string; emb: number[]; user: unknown }[]>();
  return rows.map((m) => ({ kind: m.kind, text: m.text, mine: !!m.user, s: cos(m.emb, v) })).filter((m) => m.s > 0.28).sort((a, b) => b.s - a.s).slice(0, k);
}
export async function memoryCount(user: string) {
  await dbConnect();
  const [mine, lessons] = await Promise.all([TraderMemory.countDocuments({ user: new Types.ObjectId(user) }), TraderMemory.countDocuments({ user: null, kind: "lesson" })]);
  return { mine, lessons };
}

/* ── чат ── */
async function openai(body: Record<string, unknown>): Promise<string> {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`AI алдаа: ${String(d?.error?.message || r.status).slice(0, 160)}`);
  return String(d?.choices?.[0]?.message?.content || "");
}
const SYSTEM = `Чи бол «Tesla Trader AI» — 20 жилийн туршлагатай форекс трейдер, ментор. МОНГОЛ хэлээр (кирилл), энгийн, товч (ихдээ 8 өгүүлбэр), найрсаг ярина. BUY, SELL, SL, TP, EMA, RSI зэрэг нэр томьёо англиар байж болно.
Дүрэм: 1) Зөвхөн өгөгдсөн тоо, скан, санах ойд тулгуурла — үнэ, хувь зохиохгүй. 2) Ирээдүйг баталгаажуулахгүй, ашиг амлахгүй; магадлалаар ярь. 3) Эрсдэлийн менежментийг (нэг арилжаанд 1–2%, SL заавал) байнга сануул. 4) Хэрэглэгчийн мэдэгдсэн мэдээлэл (данс, эрсдэл, брокер, арилжааны цаг) байвал ашигла. 5) Мэдэхгүй бол «мэдэхгүй» гэж хэл, шинэ скан оруулахыг санал болго. 6) Санхүүгийн зөвлөгөө биш — сургалт, шинжилгээний туслах.`;

export async function chat(o: { user: string; scanId?: string | null; message: string }) {
  await dbConnect();
  const msg = o.message.trim().slice(0, 1500);
  if (msg.length < 2) throw new Error("Асуултаа бичнэ үү");
  const scan = o.scanId ? await TraderScan.findOne({ _id: o.scanId, user: o.user }).lean<Record<string, unknown> & { _id: Types.ObjectId }>() : null;
  const [history, mem] = await Promise.all([
    TraderMsg.find({ user: o.user, scan: scan ? scan._id : null }).sort({ createdAt: -1 }).limit(12).lean<{ role: string; text: string }[]>(),
    recallMemory(o.user, msg).catch(() => []),
  ]);
  const ctx: string[] = [];
  if (scan) {
    const sn = scan.snap as Record<string, unknown> | null;
    ctx.push(`ОДООГИЙН СКАН: ${JSON.stringify({ symbol: scan.symbol, tf: scan.tf, decision: scan.decision, levels: scan.levels, text: scan.text, warnings: scan.warnings, history_of_similar_setups: scan.hist, outcome_so_far: scan.outcome, live: sn ? { price: sn.price, rsi: sn.rsi, atr: sn.atr, support: sn.support, resistance: sn.resistance } : null })}`);
  }
  if (mem.length) ctx.push(`САНАХ ОЙ (хамгийн хамаатай):\n${mem.map((m) => `- [${m.kind === "pref" ? "хэрэглэгчийн мэдээлэл" : m.kind === "lesson" ? "өмнөх арилжааны сургамж" : m.kind === "feedback" ? "хэрэглэгчийн үнэлгээ" : "өмнөх яриа"}] ${m.text}`).join("\n")}`);
  const messages = [
    { role: "system", content: `${SYSTEM}\n\n${ctx.join("\n\n") || "Скан сонгоогүй — ерөнхий асуулт."}` },
    ...history.reverse().map((m) => ({ role: m.role, content: m.text })),
    { role: "user", content: msg },
  ];
  const answer = (await openai({ model: process.env.TRADER_MODEL || "gpt-5.5", reasoning_effort: "low", max_completion_tokens: 1800, messages })).trim() || "Уучлаарай, хариулт гарсангүй. Дахин асууна уу.";
  const sid = scan ? scan._id : null;
  await TraderMsg.insertMany([{ user: o.user, scan: sid, role: "user", text: msg }, { user: o.user, scan: sid, role: "assistant", text: answer, meta: { memories: mem.length } }]);
  return { answer, used: mem.length };
}

/** Чатаас суралцах: байнгын мэдээллийг ялгаж (сонголт/профайл), ярианы товчийг санах ойд хийнэ */
export async function learnFromChat(user: string, message: string, answer: string): Promise<string[]> {
  const raw = await openai({
    model: process.env.TRADER_LEARN_MODEL || "gpt-5.4-mini", reasoning_effort: "none", max_completion_tokens: 500, response_format: { type: "json_object" },
    messages: [{ role: "user", content: `A forex trader wrote (Mongolian): «${message.slice(0, 800)}»
Extract ONLY durable facts about the trader that will matter in future conversations: account size, risk % per trade, broker or symbol suffix, platform, preferred pairs, timeframes, trading sessions/hours, style (scalp/swing), experience level, goals, rules they follow. Ignore questions and one-off market talk. Write each fact as one short Mongolian sentence in third person ("Данс нь $500.").
JSON: {"facts":["..."]} — [] if none.` }],
  }).catch(() => "{}");
  let facts: string[] = [];
  try { facts = (JSON.parse(raw).facts || []).map(String).filter((x: string) => x.length > 3).slice(0, 4); } catch { /* хоосон */ }
  for (const f of facts) await addMemory(user, "pref", f).catch(() => {});
  await addMemory(user, "chat", `Асуулт: ${message.slice(0, 400)}\nХариулт: ${answer.slice(0, 600)}`).catch(() => {});
  return facts;
}
