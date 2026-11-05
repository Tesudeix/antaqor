import dbConnect from "@/lib/mongodb";
import ConciergeConfig from "@/models/ConciergeConfig";
import ConciergeLog from "@/models/ConciergeLog";
import MetaMessage from "@/models/MetaMessage";
import MetaConversation from "@/models/MetaConversation";
import Post from "@/models/Post";
import User from "@/models/User";
import { providers, chatCompletion, type ChatMsg } from "@/lib/scoutProvider";
import { getThreadsClient } from "@/lib/adminAuth";
import { pageTokenFor } from "@/lib/metaAccounts";
import { getMemo, memoToContext, updateMemoFromTurn } from "@/lib/metaMemory";

/* ─── Messenger «Чат агент» (2026-10-28) ─────────────────────────────────────
   Хуучин бот: мессеж бүрт хариулна, welcome цэс + товч түлхэнэ, ерөнхий
   «Танд юугаар туслах вэ» өнгөтэй. Энэ агент эсрэгээр:

   1. ХАРИУЛАХ ЭСЭХИЙГ ШИЙДНЭ — «за», 👍, «баярлалаа», дутуу өгүүлбэр дээр чимээгүй.
   2. НЭГ УДАА ХАРИУЛНА — хэрэглэгч 3 мессеж дараалан бичвэл debounce хийж, сүүлчийнх
      дээр бүгдийг уншаад ганц хариу өгнө.
   3. ХҮН ШИГ — богино, эможигүй, товчгүй, өмнөх хариуг давтахгүй, бичиж байгаа
      мэт хоцорч илгээнэ.
   4. ЭЗНИЙ ДУУ — Threads пост + antaqor.com feed-ээс хэв маяг, баримт авна.
   5. ЗОХИОХГҮЙ — мэдэхгүй (үнэ, огноо) бол эзэнд шилжүүлнэ.                      */

export const ACCOUNT = "antaqor";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Cfg = {
  enabled: boolean; includeInstagram: boolean; name: string; about: string; offers: string; facts: string;
  goal: string; rules: string; handoffPhone: string; address: "чи" | "та"; useThreads: boolean; useFeed: boolean;
  disclosure: boolean; waitSec: number; maxPerDay: number;
};

let cfgCache: { at: number; v: Cfg | null } | null = null;
export async function getConciergeConfig(force = false): Promise<Cfg | null> {
  if (!force && cfgCache && Date.now() - cfgCache.at < 15_000) return cfgCache.v;
  await dbConnect();
  const row = await ConciergeConfig.findOne({ account: ACCOUNT }).lean();
  const v = row ? ({ ...(row as object) } as unknown as Cfg) : null;
  cfgCache = { at: Date.now(), v };
  return v;
}
export function bustConciergeCache() { cfgCache = null; }

/* ── Эзний дуу хоолой: Threads + feed (30 мин кэш) ── */
type Corpus = { threads: string[]; feed: string[]; at: number };
let corpus: Corpus | null = null;

export async function loadCorpus(force = false): Promise<Corpus> {
  if (!force && corpus && Date.now() - corpus.at < 30 * 60_000) return corpus;
  const threads: string[] = [];
  const feed: string[] = [];
  try {
    const client = await getThreadsClient();
    if (client) {
      const res = await client.getThreads(40);
      for (const p of ((res?.data || []) as { text?: string }[])) {
        const t = (p.text || "").trim();
        if (t.length >= 50) threads.push(t);
      }
    }
  } catch { /* Threads холбогдоогүй ч ажиллана */ }
  try {
    await dbConnect();
    const owner = await User.findOne({ email: "antaqor@gmail.com" }).select("_id").lean<{ _id: unknown }>();
    if (owner) {
      const posts = await Post.find({ author: owner._id as never, $or: [{ circle: "" }, { circle: { $exists: false } }] })
        .sort({ createdAt: -1 }).limit(120).select("content").lean<{ content?: string }[]>();
      for (const p of posts) {
        const t = (p.content || "").trim();
        if (t.length >= 50) feed.push(t);
      }
    }
  } catch { /* feed уншаагүй ч ажиллана */ }
  corpus = { threads, feed, at: Date.now() };
  return corpus;
}

const tokens = (s: string) => Array.from(new Set((s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).map((w) => w.slice(0, 7))));

/* Хэрэглэгчийн асуулттай хамгийн ойр 3 пост (үгийн давхцлаар) — баримт болгож өгнө. */
function relevant(c: Corpus, cfg: Cfg, text: string): string[] {
  const q = tokens(text);
  if (!q.length) return [];
  const pool = [...(cfg.useThreads ? c.threads : []), ...(cfg.useFeed ? c.feed : [])];
  return pool
    .map((t) => { const tk = new Set(tokens(t)); return { t, s: q.filter((w) => tk.has(w)).length }; })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.t.slice(0, 380));
}

/* ── Өгүүлбэр цэвэрлэх / давталт барих ── */
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}‍️]/gu;
const GENERIC = [
  /танд юугаар туслах/i, /юугаар туслах вэ/i, /холбогдсонд баярлалаа/i, /таны асуултад/i,
  /таны сонирхол/i, /тусалж чадсандаа/i, /дахин асуулт байвал/i, /сайн байна уу[!. ]*танд/i,
  /бидэнтэй холбогдсон/i, /удахгүй хариулах болно/i, /хэзээ ч асуугаарай/i,
];

export function tidy(raw: string): string {
  let t = raw.replace(EMOJI, "").replace(/\*\*?|__|`|#{1,6}\s/g, "").replace(/\r/g, "").trim();
  t = t.replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, "").replace(/!{2,}/g, "!").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  if (t.length > 360) {
    const cut = t.slice(0, 360);
    const i = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("\n"));
    t = (i > 120 ? cut.slice(0, i + 1) : cut).trim();
  }
  return t;
}
const bag = (s: string) => new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []));
function similar(a: string, b: string) {
  const A = bag(a), B = bag(b);
  if (!A.size || !B.size) return 0;
  let n = 0; A.forEach((w) => B.has(w) && n++);
  return n / Math.min(A.size, B.size);
}
const isGeneric = (t: string) => GENERIC.some((r) => r.test(t));

/* ── Систем prompt ── */
function systemPrompt(cfg: Cfg, c: Corpus, facts: string[]): string {
  const voice = [...(cfg.useThreads ? c.threads.slice(0, 6) : []), ...(cfg.useFeed ? c.feed.slice(0, 4) : [])]
    .map((t) => `— ${t.replace(/\n+/g, " / ").slice(0, 230)}`).join("\n");
  const you = cfg.address === "та" ? "та" : "чи";
  return `Чи бол ${cfg.name || "Antaqor"}-ийн эзэн өөрөө. Facebook Messenger дээр хүнтэй шууд чатлаж байна. Чи AI тусгай ажилтан биш — найрсаг, шууд, цаг хэмнэдэг хүн шиг бичнэ.

ТАНИЛЦУУЛГА
${cfg.about || "(оруулаагүй)"}

ЮУ САНАЛ БОЛГОДОГ
${cfg.offers || "(оруулаагүй)"}

БАРИМТ (үнэ, огноо, нөхцөл — ЗӨВХӨН эндээс)
${cfg.facts || "(оруулаагүй)"}

ЗОРИЛГО
${cfg.goal || "Асуултад нь шууд хариулж, хэрэгтэй бол дараагийн нэг алхмыг хэл."}

ЭЗНИЙ ТАВЬСАН ДҮРЭМ
${cfg.rules || "(нэмэлт дүрэм алга)"}
${facts.length ? `\nЭЗНИЙ БОДИТ ПОСТУУДААС (энэ асуулттай холбоотой — баримт, санааг ашигла, хуулж бүү наа):\n${facts.map((f) => `— ${f.replace(/\n+/g, " / ")}`).join("\n")}\n` : ""}
${voice ? `\nЭЗНИЙ ХЭВ МАЯГ (Threads/feed-ээс — өнгө аясыг нь дага, сэдвийг биш):\n${voice}\n` : ""}
ЗААВАЛ ДАГАХ
- Нэг мессеж = 1-2 богино өгүүлбэр, 200 тэмдэгтээс хэтрэхгүй. Хүн дэлгэрэнгүй асуувал л 3 хүртэл. Ярианы хэлээр.
- Хэрэглэгчид "${you}" гэж хандана.
- Эможи, hashtag, жагсаалт, markdown, товч/сонголт БИТГИЙ ашигла.
- Мэндчилгээ зөвхөн ярианы эхэнд, нэг удаа, богино. Дараа нь дахин мэндлэхгүй.
- Стандарт хоосон үг хориглоно: "танд юугаар туслах вэ", "холбогдсонд баярлалаа", "таны асуултад", "удахгүй хариулна", "асуулт байвал асуугаарай".
- Өмнө хэлсэн зүйлээ, мөн өмнөх хариутайгаа төстэй зүйлийг ДАВТАХГҮЙ. Хэрэглэгчийн хэлсэн зүйлийг дахин асуухгүй.
- Эхлээд асуултад нь шууд хариул. Борлуулалт руу түлхэхгүй; хэрэгтэй үед л нэг чиглүүлэлт (линк/алхам).
- Асуух бол НЭГ л асуулт, зөвхөн хариуг өөрчлөх үед.
- Баримтад байхгүй мэдээллийг (үнэ, огноо, амлалт) ЗОХИОХГҮЙ.

ШИЙДВЭР (action)
- "reply" — хариулах хэрэгтэй.
- "skip" — хариу хэрэггүй: за, ок, баярлалаа, 👍, ярианы төгсгөл, дутуу өгүүлбэр (хүн үргэлжлүүлж бичих гэж байна), чамд хандаагүй. Хүн шиг заримдаа чимээгүй байх нь зөв.
- "handoff" — эзэн өөрөө хариулах ёстой: баримтад байхгүй үнэ/нөхцөл, гомдол, төлбөрийн маргаан, уур бухимдал, "хүнтэй ярья" гэсэн хүсэлт. Энэ үед "reply"-д нэг богино мөр бич (жишээ: "Үүнийг би өөрөө харчихаад хариулъя").

ЗӨВХӨН JSON: {"action":"reply|skip|handoff","reply":"<мессеж, skip бол хоосон>","why":"<8 үгээс бага шалтгаан>"}`;
}

export type Think = { action: "reply" | "skip" | "handoff"; reply: string; why: string; provider: string };

function parseJson(raw: string): { action?: string; reply?: string; why?: string } | null {
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(raw.slice(a, b + 1)); } catch { return null; }
}

/* Нэг шийдвэр: transcript нь [{from:"them"|"me", text}] хуучнаас шинэ рүү. */
export async function think(
  cfg: Cfg,
  transcript: { from: "them" | "me"; text: string }[],
  extraCtx = "",
  avoid: string[] = []
): Promise<Think> {
  const c = await loadCorpus();
  const lastThem = [...transcript].reverse().filter((m) => m.from === "them").slice(0, 3).map((m) => m.text).join(" ");
  const facts = relevant(c, cfg, lastThem);
  const sys = systemPrompt(cfg, c, facts) + (extraCtx ? `\n\nЭНЭ ХҮНИЙ ТУХАЙ: ${extraCtx}` : "");
  const chat = transcript.map((m) => `${m.from === "me" ? "Чи" : "Тэр"}: ${m.text}`).join("\n");
  const antiRepeat = avoid.length ? `\n\nЧИ САЯ ИЛГЭЭСЭН (давтаж болохгүй):\n${avoid.map((a) => `— ${a}`).join("\n")}` : "";
  const messages: ChatMsg[] = [
    { role: "system", content: sys },
    { role: "user", content: `ЯРИА (хуучнаас шинэ рүү):\n${chat}${antiRepeat}\n\nОдоо шийд, JSON буцаа.` },
  ];
  for (const p of providers()) {
    const choice = await chatCompletion(p, messages, { maxTokens: 400, temperature: 0.85, reasoning: "none", timeoutMs: 25_000 }).catch(() => null);
    const raw = choice?.message?.content?.trim();
    if (!raw) continue;
    const j = parseJson(raw);
    if (!j) continue;
    const action = j.action === "skip" || j.action === "handoff" ? j.action : "reply";
    return { action, reply: tidy(String(j.reply || "")), why: String(j.why || "").slice(0, 80), provider: p.name };
  }
  return { action: "skip", reply: "", why: "ai_unavailable", provider: "" };
}

/* ── Бичиж байна гэсэн дохио (Messenger) ── */
async function typingOn(platform: string, account: string, psid: string) {
  if (platform !== "messenger") return;
  const token = pageTokenFor(account);
  if (!token) return;
  await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(token)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, sender_action: "typing_on" }),
  }).catch(() => {});
}

const ACK_ONLY = /^(?:баярлалаа|баярлалаа\.|thanks|thank you|thx|ty)[\s!.]*$/i;

export async function logDecision(d: { conversationId?: unknown; partner?: string; platform?: string; inText: string; action: string; why?: string; reply?: string; provider?: string; ms?: number }) {
  await ConciergeLog.create({ ...d, inText: d.inText.slice(0, 400) }).catch(() => {});
}

export type TurnArgs = {
  platform: string; account: string; senderId: string; convId: string; mid?: string; text: string;
  partnerName?: string; cfg: Cfg; userCtx?: string;
  send: (text: string) => Promise<void>;
  handoff: (why: string) => Promise<void>;
};

export async function conciergeTurn(a: TurnArgs): Promise<void> {
  const t0 = Date.now();
  const base = { conversationId: a.convId, partner: a.partnerName || a.senderId, platform: a.platform, inText: a.text };

  // 1. Debounce — хэрэглэгч дараалан бичиж байвал сүүлийнх л хариулна.
  await sleep(Math.min(20, Math.max(0, a.cfg.waitSec)) * 1000);
  const recent = await MetaMessage.find({ conversationId: a.convId }).sort({ createdAt: -1 }).limit(24).lean<{ direction: string; source: string; text: string; mid?: string; createdAt: Date }[]>();
  const latestIn = recent.find((m) => m.direction === "in");
  if (a.mid && latestIn?.mid && latestIn.mid !== a.mid) return; // шинэ мессеж ирсэн — тэр нь хариулна

  // 2. Эзэн өөрөө орж ярьсан бол дарахгүй.
  const conv = await MetaConversation.findById(a.convId).select("humanAt").lean<{ humanAt?: Date }>();
  const manualRecent = recent.find((m) => m.direction === "out" && m.source === "manual" && Date.now() - new Date(m.createdAt).getTime() < 20 * 60_000);
  const echoRecent = conv?.humanAt && Date.now() - new Date(conv.humanAt).getTime() < 20 * 60_000;
  if (manualRecent || echoRecent) { await logDecision({ ...base, action: "skip", why: "эзэн өөрөө ярьж байна", ms: Date.now() - t0 }); return; }

  // 3. Өдрийн хязгаар.
  const day = new Date(); day.setHours(0, 0, 0, 0);
  const sentToday = recent.filter((m) => m.direction === "out" && m.source === "ai" && new Date(m.createdAt) >= day).length;
  if (a.cfg.maxPerDay > 0 && sentToday >= a.cfg.maxPerDay) { await logDecision({ ...base, action: "skip", why: "өдрийн хязгаар", ms: Date.now() - t0 }); return; }

  // 4. Хариу шаардахгүй нь тодорхой.
  const t = a.text.trim();
  if (!/[\p{L}\p{N}]/u.test(t) || ACK_ONLY.test(t)) { await logDecision({ ...base, action: "skip", why: "хариу шаардахгүй", ms: Date.now() - t0 }); return; }

  // 5. Яриа (хуучнаас шинэ рүү) + өмнөх хариунууд.
  const chron = [...recent].reverse();
  const transcript = chron.map((m) => ({ from: (m.direction === "in" ? "them" : "me") as "them" | "me", text: m.text.replace(/^\[btn\]\s*/, "") }));
  const mine = chron.filter((m) => m.direction === "out").map((m) => m.text);
  const memo = await getMemo(a.convId).catch(() => null);
  const ctx = [a.userCtx && a.userCtx.split(" · ")[0], memoToContext(memo)].filter(Boolean).join(" ").slice(0, 600);

  let out = await think(a.cfg, transcript, ctx, mine.slice(-4));
  const tooSame = (r: string) => mine.slice(-6).some((m) => similar(m, r) >= 0.7);
  if (out.action !== "skip" && out.reply && (tooSame(out.reply) || (mine.length > 0 && isGeneric(out.reply)) || isGeneric(out.reply))) {
    const retry = await think(a.cfg, transcript, ctx, [...mine.slice(-4), out.reply]);
    out = retry;
    if (out.reply && (tooSame(out.reply) || isGeneric(out.reply))) out = { ...out, action: "skip", reply: "", why: "давтагдсан/ерөнхий хариу" };
  }

  if (out.action === "skip" || !out.reply) {
    await logDecision({ ...base, action: out.provider ? "skip" : "error", why: out.why, provider: out.provider, ms: Date.now() - t0 });
    return;
  }

  // 6. Хүн шиг: бичиж байна → хоцорч илгээнэ.
  await typingOn(a.platform, a.account, a.senderId);
  await sleep(Math.min(4500, 900 + out.reply.length * 22));
  await a.send(out.reply);

  if (out.action === "handoff") await a.handoff(out.why || "агент шийдэж чадсангүй");
  void updateMemoFromTurn(a.convId, a.text, out.reply);
  await logDecision({ ...base, action: out.action, why: out.why, reply: out.reply, provider: out.provider, ms: Date.now() - t0 });
}
