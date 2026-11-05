import { randomUUID } from "crypto";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { TuqorConfig, TuqorPost, TuqorVec, type ITuqorConfig, type ITuqorPost, type TuqorFormat } from "@/models/Tuqor";
import SocialPost from "@/models/SocialPost";
import SocialInsight from "@/models/SocialInsight";
import ThreadsToken from "@/models/ThreadsToken";
import ThreadsTrigger from "@/models/ThreadsTrigger";
import { AgentConn } from "@/models/AgentWorkspace";
import { AgentProduct } from "@/models/AgentStudio";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { buildVoicePrompt, CTA_LIBRARY, type VoicePost } from "@/lib/threadsVoice";
import { syncThreads } from "@/lib/socialThreads";
import { EMB_MODEL, embedMany } from "@/lib/embeddings";
import { validate, scheduleDate, type SocialPlatform } from "@/lib/socialInput";
import { SUPER_ADMIN_EMAILS } from "@/lib/adminAuth";
import { DAY, ub, ubAt, ubDayStart, ymd, hm } from "@/lib/contentAgentRules";

/* ─── TUQOR (2026-10-23) ─────────────────────────────────────────────────
   Өдөр бүр өөрөө: Threads-ээ уншина → vector санах ойгоо шинэчилнэ →
   өдрийн постуудыг бичнэ (нэр дэвшигч 2×) → vector ТЕСТ (ижил төстэй өмнөх
   постуудын бодит оноогоор таамаг + шинэлэг байдал) → хамгаалалт → товлоно
   → 6+ цагийн дараа бодит үр дүнг таамагтай харьцуулна (дараагийн өдөр сурна).

   Эзний шийдвэр: батлалт ХЭРЭГГҮЙ (auto). Тиймээс хүний батлалтын оронд
   ХАМГААЛАЛТ ажиллана — тэнцээгүй пост нийтлэгдэхгүй, «Анхаарах»-д үлдэнэ:
   · эзэн өгөөгүй амлалт (өнөө шөнө, маргааш, хямдрал, %, огноо)
   · өмнөх посттой хэт төстэй (cosine ≥ 0.9)
   · Threads 500 тэмдэгтээс урт
   Нийтлэх нь одоо байгаа SocialPost + /api/cron/social-schedule (шинэ нийтлэгч алга). */

type Cfg = Omit<ITuqorConfig, keyof import("mongoose").Document>;
type PostL = Omit<ITuqorPost, keyof import("mongoose").Document> & { _id: Types.ObjectId };
const FORMATS: TuqorFormat[] = ["spark", "value", "offer"];
export const FORMAT_LABEL: Record<TuqorFormat, string> = { spark: "Богино цочрол", value: "Задлал", offer: "Санал" };

const OWNER_EXAMPLES = [
  "AI тэсэрч байна.\nAI салбар экспоненциал өсөлтийн үедээ бүрэн шилжсэн",
  "Өнөө шөнө хичээл нэмэгдэнэ",
  "Claude AI сурах бол зүрх 🔥",
  "30 хоногийн дараа AI-г зүгээр чатладаг биш, санаагаа контент, зураг, видео, брэнд болгон гаргадаг системтэй creator болох бол зүрх дараарай",
];
const DEFAULT_OFFERS = [
  { name: "Antaqor хүрээлэл — AI creator сургалт", pitch: "8 модуль: AI суурь, промт инженерчлэл, дизайн систем, брэндинг, AI контент, платформууд, AI coding, AI агент. Шууд хичээл + хамтдаа бүтээх хүрээлэл.", cta: "30 хоногийн дараа AI-г зүгээр чатладаг биш, санаагаа контент, зураг, видео, брэнд болгон гаргадаг системтэй creator болох бол зүрх дараарай ❤️" },
  { name: "AI контент үйлчилгээ", pitch: "Брэнд, бизнесүүдэд AI-аар контент, зураг, видео бүтээж өгнө.", cta: "Брэндээ AI-аар өсгөх бол линк гэж бичээрэй" },
];
export const ASKS = [
  "Өнөөдөр юу хийсэн бэ? Нэг жижиг ялалт, нэг алдаа — аль нь ч болно.",
  "AI-д энэ 7 хоногт юу болов? Чамайг хамгийн их цочирдуулсан мэдээ?",
  "Сурагчид чинь хамгийн их юун дээр гацаж байна вэ?",
  "Өнөөдөр ямар хэрэгслийг ашигласан бэ? Юу хурдан болсон бэ?",
  "Хүрээлэлд шинэ юу нэмэгдэх гэж байна? (хичээл, эвент, хямдрал)",
  "Нэг хүчтэй байр суурь хэл — олонх юу буруу ойлгодог вэ?",
  "Сүүлийн үед хэнтэй уулзаад юу ойлгов?",
];

/* ─── Тохиргоо ─────────────────────────────────────────────────────────── */
export const MEDIA_DEFAULT: Cfg["media"] = { imageModel: "soul2", videoModel: "wan3", videoRes: "720p", videoDur: 5, ratio: "9:16", dailyUsd: 5 };
export const MAIN_WS = "main";
/** Workspace бүрт нэг тохиргоо (key = ws). Эзэн "main"; түрээслэгч автомат УНТРААЛТТАЙ эхэлнэ. */
export async function getConfig(ws: string = MAIN_WS): Promise<Cfg & { _id: unknown }> {
  await dbConnect();
  let c = await TuqorConfig.findOne({ key: ws }).lean<Cfg & { _id: unknown }>();
  if (!c) {
    try {
      await TuqorConfig.create(ws === MAIN_WS
        ? { key: ws, examples: OWNER_EXAMPLES, offers: DEFAULT_OFFERS, lastRunDay: ymd(new Date()) }
        : { key: ws, examples: [], offers: [], auto: false, channels: [], lastRunDay: ymd(new Date()), media: { ...MEDIA_DEFAULT, dailyUsd: 1 } });
    } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
    c = await TuqorConfig.findOne({ key: ws }).lean<Cfg & { _id: unknown }>();
  }
  // Хуучин баримтад шинэ талбарууд алга (lean → schema default ажиллахгүй)
  const base: Partial<Cfg> = { generic: [], spellFix: true, lastHourlyAt: null, examples: [] };
  const acc: Cfg["accounts"] = { metaAccount: "antaqor", threadsUserId: "" };
  return { ...base, ...c!, accounts: { ...acc, ...(c!.accounts || {}) }, media: { ...MEDIA_DEFAULT, ...(c!.media || {}) } };
}

/* ─── Vector санах ой ──────────────────────────────────────────────────── */
type Vi = { ws: string; key: string; text: string; v: Float32Array; score: number; postedAt: number; source: string };
let idx: Vi[] | null = null; let idxAt = 0;
function invalidate() { idx = null; }
async function index(): Promise<Vi[]> {
  if (idx && Date.now() - idxAt < 5 * 60e3) return idx;
  const rows = await TuqorVec.find({ embModel: EMB_MODEL }).select("+v ws key text score postedAt source").lean<{ ws?: string; key: string; text: string; v: number[]; score: number; postedAt: Date; source: string }[]>();
  idx = rows.filter((r) => r.v?.length).map((r) => ({ ws: r.ws || MAIN_WS, key: r.key, text: r.text, v: Float32Array.from(r.v), score: r.score || 0, postedAt: +new Date(r.postedAt || 0), source: r.source }));
  idxAt = Date.now();
  return idx;
}
const dot = (a: Float32Array, b: Float32Array) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

/** Өөрийн бүх постыг (Threads + IG + FB) хэмжүүртэй нь vector санах ойд. fresh → Threads-ийг шууд татна. */
export async function syncVectors(fresh = false, ws: string = MAIN_WS): Promise<{ threads: number; embedded: number; total: number }> {
  await dbConnect();
  if (ws !== MAIN_WS) return syncWsVectors(fresh, ws);
  let threads = 0;
  if (fresh) {
    const cfg = await getConfig();
    if (!cfg.lastSyncAt || Date.now() - +new Date(cfg.lastSyncAt) > 25 * 60e3) {
      try { threads = (await syncThreads()).threads; } catch { /* Threads түр унасан ч хуучин өгөгдлөөр үргэлжилнэ */ }
      await TuqorConfig.updateOne({ key: "main" }, { $set: { lastSyncAt: new Date() } });
    }
  }
  const ins = await SocialInsight.find({ caption: { $nin: ["", null] } }).select("externalId platform caption score likes comments views postedAt").lean();
  const have = new Map((await TuqorVec.find({}).select("key text embModel").lean<{ key: string; text: string; embModel: string }[]>()).map((r) => [r.key, r]));
  const ops = ins.map((r) => ({ updateOne: { filter: { key: r.externalId }, update: { $set: { ws: MAIN_WS, text: r.caption, platform: r.platform, score: r.score || 0, likes: r.likes || 0, comments: r.comments || 0, views: r.views || 0, postedAt: r.postedAt, source: "own" as const } }, upsert: true } }));
  if (ops.length) await TuqorVec.bulkWrite(ops);
  const need = ins.filter((r) => { const h = have.get(r.externalId); return !h || h.embModel !== EMB_MODEL || h.text !== r.caption; });
  let embedded = 0;
  for (let i = 0; i < need.length; i += 96) {
    const b = need.slice(i, i + 96);
    const vecs = await embedMany(b.map((r) => r.caption));
    await TuqorVec.bulkWrite(b.map((r, j) => ({ updateOne: { filter: { key: r.externalId }, update: { $set: { v: vecs[j], embModel: EMB_MODEL } } } })));
    embedded += b.length;
  }
  if (embedded || ops.length) invalidate();
  return { threads, embedded, total: ins.length };
}

/** Түрээслэгч: өөрийн Threads-ийг (AgentConn токен) татаж vector + оноо болгоно. SocialInsight-д
 *  БИЧИХГҮЙ (тэр нь эзний аналитик). Холболтгүй бол зөвхөн embed хийгдээгүй мөрүүдийг нөхнө. */
const TG = "https://graph.threads.net/v1.0";
async function syncWsVectors(fresh: boolean, ws: string): Promise<{ threads: number; embedded: number; total: number }> {
  let threads = 0;
  if (fresh) {
    const cfg = await getConfig(ws);
    if (!cfg.lastSyncAt || Date.now() - +new Date(cfg.lastSyncAt) > 25 * 60e3) {
      await TuqorConfig.updateOne({ key: ws }, { $set: { lastSyncAt: new Date() } });
      const conn = await AgentConn.findOne({ ws, platform: "threads", status: { $ne: "reconnect_needed" } }).select("+accessToken expiresAt").lean<{ _id: Types.ObjectId; accessToken: string; expiresAt: Date | null }>();
      if (conn?.accessToken) {
        type P = { id: string; text?: string; timestamp: string; media_type?: string };
        const r = await fetch(`${TG}/me/threads?fields=id,text,timestamp,media_type&limit=40&access_token=${conn.accessToken}`, { signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({ error: { message: "network" } }));
        if (r.error) { if (/expired|session|OAuth/i.test(String(r.error.message || ""))) await AgentConn.updateOne({ _id: conn._id }, { $set: { status: "reconnect_needed" } }); }
        else {
          const have = new Map((await TuqorVec.find({ ws }).select("key text").lean<{ key: string; text: string }[]>()).map((x) => [x.key, x.text]));
          for (const p of (r.data || []) as P[]) {
            if (!p.text || p.media_type === "REPOST_FACADE") continue;
            const ins = await fetch(`${TG}/${p.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${conn.accessToken}`, { signal: AbortSignal.timeout(15000) }).then((x) => x.json()).catch(() => ({}));
            const v: Record<string, number> = {};
            for (const d of ins.data || []) v[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
            const likes = v.likes || 0, comments = v.replies || 0, shares = (v.reposts || 0) + (v.quotes || 0);
            const key = `th_${p.id}`;
            const set: Record<string, unknown> = { ws, text: p.text, platform: "threads", source: "own", likes, comments, views: v.views || 0, score: likes + 2 * comments + 3 * shares, postedAt: new Date(p.timestamp) };
            if (have.get(key) !== p.text) set.embModel = "";
            await TuqorVec.updateOne({ key }, { $set: set }, { upsert: true });
            threads++;
          }
        }
      }
    }
  }
  const need = await TuqorVec.find({ ws, source: { $ne: "note" }, embModel: { $ne: EMB_MODEL } }).select("key text").limit(200).lean<{ key: string; text: string }[]>();
  for (let i = 0; i < need.length; i += 96) {
    const b = need.slice(i, i + 96);
    const vecs = await embedMany(b.map((r) => r.text));
    await TuqorVec.bulkWrite(b.map((r, j) => ({ updateOne: { filter: { key: r.key }, update: { $set: { v: vecs[j], embModel: EMB_MODEL } } } })));
  }
  if (need.length || threads) invalidate();
  return { threads, embedded: need.length, total: await TuqorVec.countDocuments({ ws }) };
}

/** Vector ТЕСТ: ижил төстэй өмнөх постуудын бодит онооны жигнэсэн дундаж = таамаг;
 *  1 − хамгийн ойрын cosine = шинэлэг байдал (давхардлыг илрүүлнэ). */
export async function predict(texts: string[], extra: string[] = [], ws: string = MAIN_WS): Promise<{ score: number; novelty: number; base: number; nn: { text: string; score: number }[] }[]> {
  if (!texts.length) return [];
  const all = (await index()).filter((x) => x.ws === ws);
  const now = Date.now();
  const mature = all.filter((x) => x.source !== "note" && x.postedAt && now - x.postedAt > DAY);
  const base = mature.length ? Math.round(mature.reduce((a, x) => a + x.score, 0) / mature.length * 10) / 10 : 0;
  const recent = all.filter((x) => x.source !== "note" && now - x.postedAt < 60 * DAY);
  const vecs = await embedMany([...texts, ...extra]);
  const extraV = vecs.slice(texts.length).map((v) => Float32Array.from(v));
  return texts.map((_, i) => {
    const q = Float32Array.from(vecs[i]);
    const sims = mature.map((x) => ({ x, s: dot(q, x.v) })).sort((a, b) => b.s - a.s).slice(0, 8);
    let w = 0, sum = 0;
    for (const { x, s } of sims) { const k = Math.pow(Math.max(0, s), 3); w += k; sum += k * x.score; }
    const pred = w ? sum / w : base;
    let maxSim = 0;
    for (const x of recent) maxSim = Math.max(maxSim, dot(q, x.v));
    for (const e of extraV) maxSim = Math.max(maxSim, dot(q, e));
    return { score: Math.round(pred * 10) / 10, novelty: Math.round((1 - maxSim) * 100) / 100, base, nn: sims.slice(0, 3).map(({ x }) => ({ text: x.text.slice(0, 140), score: x.score })) };
  });
}

/* ─── Хамгаалалт (батлалтын оронд) ────────────────────────────────────── */
const PROMISE = /(өнөө\s*(шөнө|орой|өдөр)|маргааш|нөгөөдөр|энэ\s*(долоо\s*хоног|сард|амралт)|\d+\s*(%|хувь)|хямдрал|үнэгүй|урамшуулал|эхэлнэ|нээгдэнэ|нэмэгдэнэ|сүүлийн\s*\d|\d{1,2}[:/]\d{2}|\d+\s*(₮|төгрөг|ширхэг|суудал))/iu;
export function guard(text: string, idea: string, platforms: string[]): string[] {
  const out: string[] = [];
  const t = text.trim();
  if (!t) out.push("Хоосон");
  if (platforms.includes("threads") && Array.from(t).length > 500) out.push(`Threads 500 тэмдэгтээс урт (${Array.from(t).length})`);
  const m = PROMISE.exec(t);
  if (m && !idea.toLowerCase().includes(m[0].toLowerCase().replace(/\s+/g, " ").split(" ")[0])) out.push(`Эзэн өгөөгүй амлалт/баримт: «${m[0]}»`);
  return out;
}

/* ─── Бичих ────────────────────────────────────────────────────────────── */
export async function voicePosts(ws: string = MAIN_WS): Promise<VoicePost[]> {
  if (ws !== MAIN_WS) {
    const own = await TuqorVec.find({ ws, source: "own", platform: "threads" }).sort({ postedAt: -1 }).limit(40).select("key text postedAt").lean<{ key: string; text: string; postedAt: Date }[]>();
    return own.map((r) => ({ id: r.key, text: r.text, timestamp: new Date(r.postedAt || Date.now()).toISOString(), permalink: "" }));
  }
  const rows = await SocialInsight.find({ platform: "threads", caption: { $nin: ["", null] } }).sort({ postedAt: -1 }).limit(40).lean();
  return rows.map((r) => ({ id: r.externalId, text: r.caption, timestamp: new Date(r.postedAt).toISOString(), permalink: r.permalink }));
}
export async function allowedCtas(cfg: Pick<Cfg, "offers">, ws: string = MAIN_WS) {
  if (ws !== MAIN_WS) {
    /* түрээслэгч: Antaqor-ийн CTA-г хэзээ ч ашиглахгүй — өөрийн бүтээгдэхүүний CTA эсвэл энгийн уриалга */
    const prods = await AgentProduct.find({ ws, active: true }).select("cta").lean<{ cta: string }[]>();
    const own = [...cfg.offers.map((o) => o.cta), ...prods.map((p) => p.cta)].filter(Boolean);
    return own.length ? Array.from(new Set(own)) : ["Дэлгэрэнгүйг inbox-оор асуугаарай", "Захиалах бол мессеж бичээрэй", "Хадгалаад дараа нь ашиглаарай"];
  }
  const trig = await ThreadsTrigger.find({ enabled: true }).select("keywords").lean<{ keywords: string[] }[]>();
  const kw = new Set(trig.flatMap((t) => t.keywords.map((k) => k.toLowerCase())));
  const lib = CTA_LIBRARY.filter((c) => !c.keyword || kw.has(c.keyword.toLowerCase())).map((c) => c.text);
  return Array.from(new Set([...cfg.offers.map((o) => o.cta).filter(Boolean), ...lib]));
}
function parseArr(raw: string): { format?: string; text?: string }[] {
  const s = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  try { const j = JSON.parse(a >= 0 ? s.slice(a, b + 1) : s); return Array.isArray(j) ? j : []; } catch { return []; }
}

async function generate(cfg: Cfg, formats: TuqorFormat[], idea: string, todayTexts: string[]): Promise<{ list: { format: TuqorFormat; text: string }[]; model: string }> {
  const [recent, ctas, top] = await Promise.all([
    voicePosts(), allowedCtas(cfg),
    TuqorVec.find({ platform: "threads" }).sort({ score: -1 }).limit(6).select("text score").lean<{ text: string; score: number }[]>(),
  ]);
  const learned = await lessons();
  const want = formats.reduce<Record<string, number>>((m, f) => { m[f] = (m[f] || 0) + 2; return m; }, {});
  const system = `${buildVoicePrompt(recent)}

─── TUQOR ───
Чи бол Tuqor — @antaqor-ийн контент агент. Эзний дуу хоолойгоор, эзний нэрээр бичнэ.
Дээрх «Урт: 150-400» дүрэм зөвхөн value форматад. spark богино, offer дунд.
Худал баримт, зохиомол тоо, огноо, хямдрал, «өнөө шөнө» гэх мэт амлалт ЗОХИОХГҮЙ — эзний өнөөдрийн санаанд байвал л ашиглана.`;
  const user = [
    `Нийт ${Object.values(want).reduce((a, b) => a + b, 0)} нэр дэвшигч пост бич: ${Object.entries(want).map(([f, n]) => `${f} ×${n}`).join(", ")}.`,
    "",
    "ФОРМАТ:",
    "- spark — богино цочрол: 1–3 мөр, 30–180 тэмдэгт. Зоригтой ганц мэдэгдэл, AI-ийн мэдээ, сэтгэл хөдөлгөм дуудлага. CTA байж болно, үгүй ч болно.",
    "- value — задлал: 4–8 мөр, 150–420 тэмдэгт. Нэг тодорхой ажиглалт эсвэл туршлага, мөр бүр урагшилна. Сүүлийн мөр нь CTA.",
    "- offer — санал: 2–5 мөр, 60–300 тэмдэгт. Доорх курс/үйлчилгээг санал болгоно — зөвхөн өгөгдсөн тайлбараар. Сүүлийн мөр нь CTA.",
    "",
    `ЭЗНИЙ ӨӨРИЙН ЖИШЭЭ (энэ өнгө аяс, энэ эрч хүч, энэ CTA):\n${cfg.examples.map((e) => `«${e}»`).join("\n")}`,
    "",
    `САНАЛ БОЛГОХ ЗҮЙЛС:\n${cfg.offers.map((o) => `· ${o.name} — ${o.pitch}`).join("\n")}`,
    "",
    `CTA (сүүлийн мөр — яг үгээр нь, эсвэл маш ойрхон):\n${ctas.map((c) => `· ${c}`).join("\n")}`,
    "",
    top.length ? `ХАМГИЙН ИХ АЖИЛЛАСАН ПОСТУУД (оноо = like + 2×reply + 3×repost):\n${top.map((t) => `[${t.score}] ${t.text.replace(/\s+/g, " ").slice(0, 200)}`).join("\n")}` : "",
    learned.length ? `\nСҮҮЛИЙН 14 ХОНОГИЙН ТЕСТ (Tuqor-ын өөрийн постууд):\n${learned.map((l) => `· ${l}`).join("\n")}` : "",
    todayTexts.length ? `\nӨНӨӨДӨР АЛЬ ХЭДИЙН ГАРСАН/ТОВЛОСОН — сэдэв, эхлэлийг давтахгүй:\n${todayTexts.map((t) => `· ${t.split("\n")[0].slice(0, 90)}`).join("\n")}` : "",
    "",
    idea.trim() ? `ЭЗНИЙ ӨНӨӨДРИЙН САНАА (үндсэн сэдэв, баримт нь энд л байна):\n${idea.trim()}` : "ЭЗНИЙ САНАА: алга. Өөрөө сонго — AI салбарын хөдөлгөөн, creator систем, Claude/ChatGPT/agent, бүтээмж, leverage. Баримт зохиохгүй.",
    "",
    `ЗӨВХӨН JSON массив: [{"format":"spark|value|offer","text":"постын бүтэн текст"}]`,
  ].filter((x) => x !== "").join("\n");
  const fails: string[] = [];
  for (const p of providers().map((x) => (x.name === "openai" ? { ...x, model: process.env.TUQOR_MODEL || process.env.THREADS_WRITER_MODEL || "gpt-5.4" } : x))) {
    try {
      const c = await chatCompletion(p, [{ role: "system", content: system }, { role: "user", content: user }], { maxTokens: 3200, temperature: 0.95, reasoning: "none", timeoutMs: 90_000, onAttempt: (a) => { if (!a.ok) fails.push(`${a.name}: ${a.code || a.status || ""}`); } });
      const arr = parseArr(String(c?.message?.content || ""));
      const list = arr.map((x) => ({ format: (FORMATS.includes(x.format as TuqorFormat) ? x.format : "value") as TuqorFormat, text: String(x.text || "").trim() })).filter((x) => x.text.length >= 12);
      if (list.length) return { list, model: `${p.name}:${p.model}` };
    } catch (e) { fails.push(`${p.name}: ${(e as Error).message}`); }
  }
  throw new Error(`AI бичиж чадсангүй — ${fails.slice(0, 3).join(" · ")}`);
}

/** Сүүлийн 14 хоногийн тестийн дүгнэлт (формат бүрийн бодит дундаж ба таамгаас зөрөө). */
export async function lessons(ws: string = MAIN_WS): Promise<string[]> {
  const rows = await TuqorPost.find({ ws, evaluated: true, at: { $gte: new Date(Date.now() - 14 * DAY) } }).select("format metrics.score pred.score").lean<{ format: TuqorFormat; metrics: { score: number }; pred: { score: number } }[]>();
  const out: string[] = [];
  for (const f of FORMATS) {
    const r = rows.filter((x) => x.format === f);
    if (r.length < 2) continue;
    const avg = r.reduce((a, x) => a + x.metrics.score, 0) / r.length;
    const pr = r.reduce((a, x) => a + (x.pred.score || 0), 0) / r.length;
    out.push(`${FORMAT_LABEL[f]} (${f}): ${r.length} пост, бодит дундаж ${avg.toFixed(1)}, таамаг ${pr.toFixed(1)}${pr ? ` → ${avg >= pr ? "+" : ""}${Math.round((avg / pr - 1) * 100)}%` : ""}`);
  }
  return out;
}

/* ─── Хуваарь ──────────────────────────────────────────────────────────── */
export async function busyTimes(from: Date, to: Date, ws: string = MAIN_WS): Promise<number[]> {
  /* эзэн: ws талбаргүй/хоосон SocialPost (хуучин бүх урсгал); түрээслэгч: зөвхөн өөрийнх */
  const sp = await SocialPost.find({ state: { $in: ["scheduled", "publishing", "published"] }, ws: ws === MAIN_WS ? { $in: ["", null] } : ws, $or: [{ scheduledAt: { $gte: from, $lt: to } }, { scheduledAt: null, createdAt: { $gte: from, $lt: to } }] }).select("scheduledAt createdAt platforms").lean();
  return sp.filter((p) => ws !== MAIN_WS || (p.platforms || []).includes("threads")).map((p) => +new Date(p.scheduledAt || p.createdAt));
}
/** Өгсөн өдрийн (УБ) сул цагууд — өнгөрсөн, бусад посттой ойр цагийг алгасна. */
async function freeSlots(cfg: Cfg, dayStart: Date, n: number): Promise<Date[]> {
  const busy = await busyTimes(dayStart, new Date(+dayStart + DAY));
  const min = Date.now() + 20 * 60e3;
  const out: Date[] = [];
  for (const h of [...cfg.hours].sort((a, b) => a - b)) {
    if (out.length >= n) break;
    const t = ubAt(dayStart, h);
    if (+t < min) continue;
    if ([...busy, ...out.map(Number)].some((b) => Math.abs(b - +t) < cfg.minGapMin * 60e3)) continue;
    out.push(t);
  }
  return out;
}

/** Санаагаар бичсэн пост — тогтмол цагийг хүлээхгүй: өнөөдрөөс эхлэн 09:00–23:00 доторх
 *  дараагийн сул 30 минутын цонх (бусад посттой minGap зайтай). */
async function ideaSlots(cfg: Cfg, n: number): Promise<Date[]> {
  const out: Date[] = [];
  const today = ubDayStart(new Date());
  for (let d = 0; d < 7 && out.length < n; d++) {
    const day0 = new Date(+today + d * DAY);
    const busy = await busyTimes(day0, new Date(+day0 + DAY));
    for (let m = 9 * 60; m <= 23 * 60 && out.length < n; m += 30) {
      const t = new Date(+day0 + m * 60e3);
      if (+t < Date.now() + 15 * 60e3) continue;
      if ([...busy, ...out.map(Number)].some((b) => Math.abs(b - +t) < cfg.minGapMin * 60e3)) continue;
      out.push(t);
    }
  }
  return out;
}

async function threadsAccount(ws: string = MAIN_WS): Promise<string> {
  if (ws !== MAIN_WS) return (await AgentConn.findOne({ ws, platform: "threads" }).sort({ createdAt: 1 }).lean<{ threadsUserId: string }>())?.threadsUserId || "";
  const t = (await ThreadsToken.findOne({ username: /antaqor/i }).lean<{ threadsUserId: string }>()) || (await ThreadsToken.findOne({}).lean<{ threadsUserId: string }>());
  return t?.threadsUserId || "";
}
export async function schedule(p: PostL): Promise<{ ok: boolean; error?: string }> {
  const ws = p.ws || MAIN_WS;
  const cfg = await getConfig(ws);
  const platforms = p.platforms as SocialPlatform[];
  const site = (process.env.PUBLIC_SITE_URL || "https://antaqor.com").replace(/\/$/, "");
  const abs = (u: string) => (u ? (/^https?:/.test(u) ? u : `${site}${u}`) : "");
  /* видео байвал видео (Threads видео, IG/FB Reel), үгүй бол зураг — хоёуланг нь зэрэг илгээхгүй */
  const videoUrl = abs(p.videoUrl || "");
  const imageUrl = videoUrl ? "" : abs(p.imageUrl);
  const problems = validate({ text: p.text, imageUrl: imageUrl || undefined, videoUrl: videoUrl || undefined, platforms, overrides: {} });
  let threadsUserId = platforms.includes("threads") ? (p.threadsUserId || cfg.accounts?.threadsUserId || await threadsAccount(ws)) : "";
  let metaAccount = platforms.some((x) => x !== "threads") ? (p.metaAccount || cfg.accounts?.metaAccount || (ws === MAIN_WS ? "antaqor" : "")) : "";
  if (ws !== MAIN_WS) {
    /* түрээслэгч ЗӨВХӨН өөрийн холбосон аккаунт руу нийтэлнэ */
    const conns = await AgentConn.find({ ws }).select("platform key threadsUserId").lean<{ platform: string; key: string; threadsUserId: string }[]>();
    const metas = conns.filter((c) => c.platform === "meta").map((c) => c.key), ths = conns.filter((c) => c.platform === "threads").map((c) => c.threadsUserId);
    if (threadsUserId && !ths.includes(threadsUserId)) threadsUserId = ths[0] || "";
    if (metaAccount && !metas.includes(metaAccount)) metaAccount = metas[0] || "";
    if (!metaAccount && platforms.some((x) => x !== "threads")) metaAccount = metas[0] || "";
    if (platforms.some((x) => x !== "threads") && !metaAccount) problems.push("Facebook хуудас холбогдоогүй — «Холболт» хэсгээс холбоно уу");
  }
  if (platforms.includes("threads") && !threadsUserId) problems.push("Threads холбогдоогүй — «Холболт» хэсгээс холбоно уу");
  try { scheduleDate(new Date(p.at).toISOString()); } catch (e) { problems.push((e as Error).message); }
  if (problems.length) return { ok: false, error: problems.join(" · ") };
  const doc = await SocialPost.create({
    text: p.text.trim(), imageUrl, videoUrl, brief: `[ANTAQOR AGENT · ${p.kind === "infographic" ? "Infographic" : p.kind === "video" ? "AI видео" : p.kind === "image" ? "AI зураг" : FORMAT_LABEL[p.format]}] ${p.text.split("\n")[0].slice(0, 80)}`,
    platforms, overrides: {}, metaAccount, threadsUserId,
    threads: { linkUrl: "", replyControl: "", topicTag: "" }, results: [], state: "scheduled", scheduledAt: new Date(p.at),
    requestKey: randomUUID(), createdByEmail: "agent@antaqor.com", lastError: "", ws: ws === MAIN_WS ? "" : ws,
  });
  await TuqorPost.updateOne({ _id: p._id }, { $set: { status: "scheduled", socialPostId: String(doc._id), holdReason: "", day: ymd(new Date(p.at)), queued: false } });
  return { ok: true };
}

/** Санаа (эсвэл автомат) → нэр дэвшигч 2× → тест → хамгийн сайныг товлох. */
export async function write(opts: { idea?: string; count?: number; formats?: TuqorFormat[]; source: "auto" | "idea"; day?: Date }): Promise<PostL[]> {
  await dbConnect();
  const cfg = await getConfig();
  /* Бичихээс өмнө Threads-ээ уншина (25 мин-д нэг удаа) — шинэ постууд vector санах ойд орно */
  try { await syncVectors(true); } catch { /* embedding түр унасан бол хуучин санах ойгоор */ }
  const idea = (opts.idea || "").slice(0, 1500);
  const count = Math.max(1, Math.min(6, opts.count || 3));
  const formats = (opts.formats?.length ? opts.formats : Array.from({ length: count }, (_, i) => (cfg.mix[i % cfg.mix.length] || "value") as TuqorFormat)).slice(0, count);
  /* цаг: өнөөдрөөс эхлэн сул цагууд (санаагаар бичвэл маргааш руу ч орно) */
  let slots: Date[] = opts.source === "idea" ? await ideaSlots(cfg, count) : [];
  const start = ubDayStart(opts.day || new Date());
  for (let d = 0; opts.source === "auto" && d < 7 && slots.length < count; d++) slots = slots.concat(await freeSlots(cfg, new Date(+start + d * DAY), count - slots.length));
  if (opts.source === "auto" && opts.day) slots = slots.filter((s) => ymd(s) === ymd(start));
  if (!slots.length) throw new Error(opts.source === "auto" ? "Өнөөдөр сул цаг үлдсэнгүй" : "Ойрын 7 хоногийн цаг бүгд дүүрсэн — Тохиргоо → «Өдөрт хэдэн пост»/цагуудаа нэмнэ үү");
  const todays = await TuqorPost.find({ day: ymd(slots[0]), status: { $ne: "deleted" } }).select("text").lean<{ text: string }[]>();
  const { list, model } = await generate(cfg, formats, idea, todays.map((t) => t.text));
  const preds = await predict(list.map((x) => x.text), todays.map((t) => t.text));
  const cands = list.map((x, i) => ({ ...x, pred: preds[i], reasons: guard(x.text, idea, cfg.channels) }))
    .map((c) => (c.pred.novelty < 0.1 ? { ...c, reasons: [...c.reasons, `Өмнөх посттой хэт төстэй (${Math.round((1 - c.pred.novelty) * 100)}%)`] } : c));
  const rank = (c: (typeof cands)[number]) => (c.reasons.length ? -1000 : 0) + (c.pred.score || c.pred.base) * (0.6 + c.pred.novelty);
  const chosen: typeof cands = [];
  for (const f of formats) {
    const pool = cands.filter((c) => c.format === f && !chosen.includes(c)).sort((a, b) => rank(b) - rank(a));
    const pick = pool[0] || cands.filter((c) => !chosen.includes(c)).sort((a, b) => rank(b) - rank(a))[0];
    if (pick) chosen.push(pick);
  }
  /* өглөө богино, орой урт (шилдэг цаг 21–24) */
  const order: Record<TuqorFormat, number> = { spark: 0, offer: 1, value: 2 };
  chosen.sort((a, b) => order[a.format] - order[b.format]);
  const created: PostL[] = [];
  for (let i = 0; i < chosen.length && i < slots.length; i++) {
    const c = chosen[i];
    const doc = await TuqorPost.create({
      day: ymd(slots[i]), at: slots[i], text: c.text, format: c.format, source: opts.source, idea, platforms: cfg.channels,
      status: c.reasons.length ? "held" : cfg.auto ? "draft" : "draft", holdReason: c.reasons.join(" · "), pred: c.pred, aiModel: model,
    });
    const p = doc.toObject() as unknown as PostL;
    if (!c.reasons.length && cfg.auto) {
      const r = await schedule(p);
      if (!r.ok) await TuqorPost.updateOne({ _id: doc._id }, { $set: { status: "held", holdReason: r.error } });
    }
    created.push((await TuqorPost.findById(doc._id).lean<PostL>())!);
  }
  return created;
}

/* ─── Гараар удирдах ───────────────────────────────────────────────────── */
async function cancelSocial(p: PostL): Promise<void> {
  if (!p.socialPostId) return;
  const gone = await SocialPost.findOneAndDelete({ _id: p.socialPostId, state: "scheduled" });
  if (!gone && (await SocialPost.exists({ _id: p.socialPostId, state: { $in: ["publishing", "published"] } }))) throw new Error("Аль хэдийн нийтлэгдсэн");
}
export async function act(id: string, action: "publish" | "now" | "delete" | "edit", body: { text?: string; at?: string } = {}) {
  await dbConnect();
  const p = await TuqorPost.findById(id).lean<PostL>();
  if (!p) throw new Error("Пост олдсонгүй");
  if (action === "delete") {
    await cancelSocial(p);
    await TuqorPost.updateOne({ _id: id }, { $set: { status: "deleted" } });
    return;
  }
  if (action === "edit") {
    if (!["draft", "held", "scheduled"].includes(p.status)) throw new Error("Энэ төлөвт засахгүй");
    const text = typeof body.text === "string" ? body.text.slice(0, 2000) : p.text;
    const at = body.at ? new Date(body.at) : new Date(p.at);
    if (!Number.isFinite(+at)) throw new Error("Цаг буруу");
    if (p.status === "scheduled") {
      const r = await SocialPost.updateOne({ _id: p.socialPostId, state: "scheduled" }, { $set: { text: text.trim(), scheduledAt: at } });
      if (!r.matchedCount) throw new Error("Аль хэдийн нийтлэгдсэн");
    }
    await TuqorPost.updateOne({ _id: id }, { $set: { text, at, day: ymd(at), holdReason: p.status === "held" ? "Гараар зассан — «Нийтлэх» дарна уу" : p.holdReason } });
    return;
  }
  /* publish = хамгаалалтыг эзэн өөрөө давуулж товлоно; now = 1 минутын дараа */
  if (p.status === "scheduled" && action === "now") {
    const r = await SocialPost.updateOne({ _id: p.socialPostId, state: "scheduled" }, { $set: { scheduledAt: new Date(Date.now() + 70e3) } });
    if (!r.matchedCount) throw new Error("Аль хэдийн нийтлэгдсэн");
    await TuqorPost.updateOne({ _id: id }, { $set: { at: new Date(Date.now() + 70e3) } });
    return;
  }
  if (!["draft", "held", "failed"].includes(p.status)) throw new Error("Энэ төлөвт нийтлэхгүй");
  const at = action === "now" || +new Date(p.at) < Date.now() + 70e3 ? new Date(Date.now() + 70e3) : new Date(p.at);
  await TuqorPost.updateOne({ _id: id }, { $set: { at, day: ymd(at) } });
  const r = await schedule({ ...p, at });
  if (!r.ok) throw new Error(r.error);
}

/* ─── Өдрийн мөчлөг (cron, 5 мин тутам) ─────────────────────────────────── */
let adminId: unknown = null;
async function admin() {
  if (!adminId) adminId = (await User.findOne({ email: SUPER_ADMIN_EMAILS[0] }).select("_id").lean<{ _id: unknown }>())?._id || null;
  return adminId;
}
export async function tick(): Promise<Record<string, unknown>> {
  await dbConnect();
  await getConfig();
  const lock = await TuqorConfig.findOneAndUpdate({ key: "main", $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }] }, { $set: { lockedUntil: new Date(Date.now() + 4 * 60e3) } }, { new: true }).lean<Cfg>();
  if (!lock) return { skipped: "locked" };
  const out: Record<string, unknown> = {};
  try {
    const today = ymd(new Date()), h = ub(new Date()).h;
    /* 1) Нийтлэлийн төлөв */
    const live = await TuqorPost.find({ status: "scheduled", socialPostId: { $ne: "" } }).lean<PostL[]>();
    const sps = await SocialPost.find({ _id: { $in: live.map((p) => p.socialPostId) } }).select("state results lastError").lean();
    const byId = new Map(sps.map((s) => [String(s._id), s]));
    for (const p of live) {
      const s = byId.get(p.socialPostId);
      if (!s) { await TuqorPost.updateOne({ _id: p._id }, { $set: { status: "draft", socialPostId: "" } }); continue; }
      if (s.state === "published" || s.state === "failed") {
        await TuqorPost.updateOne({ _id: p._id }, { $set: { status: s.state, holdReason: s.state === "failed" ? s.lastError || "Нийтлэхэд алдаа" : "", results: s.results.map((r) => ({ platform: r.platform, status: r.status, permalink: r.permalink || "", externalId: r.externalId || "" })) } });
      }
    }
    /* 2) Тест: нийтлэгдээд 6+ цаг болсон постын бодит үр дүн (Threads-ээс шинээр татна) */
    const due = await TuqorPost.find({ status: "published", evaluated: false, at: { $lte: new Date(Date.now() - 6 * 3600e3) } }).lean<PostL[]>();
    if (due.length || (lock.auto && lock.lastRunDay !== today && h >= lock.runHour)) out.sync = await syncVectors(true);
    for (const p of due) {
      const ext = p.results.filter((r) => r.status === "ok" && r.externalId).map((r) => `${r.platform === "threads" ? "th_" : r.platform === "instagram" ? "ig_" : "fb_"}${r.externalId}`);
      const ins = await SocialInsight.find({ externalId: { $in: ext } }).lean();
      if (!ins.length && Date.now() - +new Date(p.at) < 48 * 3600e3) continue;
      const m = ins.reduce((a, i) => ({ likes: a.likes + i.likes, comments: a.comments + i.comments, shares: a.shares + i.shares, views: a.views + (i.views || 0), score: a.score + i.score }), { likes: 0, comments: 0, shares: 0, views: 0, score: 0 });
      await TuqorPost.updateOne({ _id: p._id }, { $set: { metrics: { ...m, at: new Date() }, evaluated: true } });
    }
    out.evaluated = due.length;
    /* 3) Өдрийн автомат ажил */
    if (lock.auto && lock.lastRunDay !== today && h >= lock.runHour) {
      await TuqorConfig.updateOne({ key: "main" }, { $set: { lastRunDay: today } });
      const have = await TuqorPost.countDocuments({ day: today, status: { $ne: "deleted" } });
      const need = Math.max(0, lock.perDay - have);
      if (need) {
        try { const made = await write({ source: "auto", count: need, day: new Date() }); out.wrote = made.length; }
        catch (e) { out.writeError = (e as Error).message; }
      }
      const uid = await admin();
      if (uid && lock.lastAskDay !== today) {
        await Notification.create({ recipient: uid, type: "system", title: "Antaqor Agent", message: `${ASKS[ub(new Date()).wd % ASKS.length]} — нэг санаа хэлбэл 3 пост болгоно.`, link: "/content-agent" }).catch(() => {});
        await TuqorConfig.updateOne({ key: "main" }, { $set: { lastAskDay: today } });
      }
    }
  } finally {
    await TuqorConfig.updateOne({ key: "main" }, { $set: { lockedUntil: null } });
  }
  return out;
}

/* ─── Дэлгэцийн төлөв ─────────────────────────────────────────────────── */
export async function state() {
  await dbConnect();
  const cfg = await getConfig();
  const now = new Date();
  const from = ubDayStart(now);
  const [upcoming, held, published, week, vecCount, learned, campaign] = await Promise.all([
    TuqorPost.find({ status: { $in: ["scheduled", "draft"] }, at: { $gte: new Date(Date.now() - 3600e3) } }).sort({ at: 1 }).limit(30).lean(),
    TuqorPost.find({ status: { $in: ["held", "failed"] }, at: { $gte: new Date(Date.now() - 3 * DAY) } }).sort({ at: 1 }).limit(20).lean(),
    TuqorPost.find({ status: "published" }).sort({ at: -1 }).limit(12).lean(),
    TuqorPost.find({ status: "published", at: { $gte: new Date(Date.now() - 7 * DAY) } }).select("metrics pred evaluated").lean(),
    TuqorVec.countDocuments({ embModel: EMB_MODEL }),
    lessons(),
    busyTimes(from, new Date(+from + 2 * DAY)),
  ]);
  const ev = week.filter((p) => p.evaluated);
  const avg = (a: number[]) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
  const ownAvg = await TuqorVec.aggregate([{ $match: { platform: "threads", postedAt: { $gte: new Date(Date.now() - 30 * DAY), $lte: new Date(Date.now() - DAY) } } }, { $group: { _id: null, a: { $avg: "$score" } } }]);
  return {
    now, cfg: { auto: cfg.auto, perDay: cfg.perDay, hours: cfg.hours, channels: cfg.channels, offers: cfg.offers, examples: cfg.examples, runHour: cfg.runHour, minGapMin: cfg.minGapMin },
    ask: ASKS[ub(now).wd % ASKS.length],
    upcoming, held, published,
    stats: { published7: week.length, score7: ev.reduce((a, p) => a + p.metrics.score, 0), avgActual: avg(ev.map((p) => p.metrics.score)), avgPred: avg(ev.map((p) => p.pred.score)), ownAvg30: Math.round((ownAvg[0]?.a || 0) * 10) / 10, vectors: vecCount },
    learned,
    otherToday: campaign.filter((t) => t >= Date.now()).map((t) => hm(new Date(t))),
  };
}
