import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import { ZCard, ZMsg, ZTest, ZPersona } from "@/models/ZAgent";
import { MENTOR_PROMPT } from "@/lib/z/systemPrompt";
import THINKING_OS from "@/lib/z/thinkingOs.json";
import AXIOMS from "@/lib/z/salesAxioms.json";
import { embedPair, retrieve, rememberMsg, rememberOutcome, forgetUser, type Hit } from "@/lib/z/vectors";

/* ─── /z агентын нэг алхам (2026-11-03, 2026-11-04 худалдааны ментор болгосон) ──
   Давхаргууд: (1) Thinking OS — ХЭРХЭН бодох; (2) salesAxioms — бизнес, худалдааны
   аксиом (хариулт бүр нэгэн дээр тулгуурлана); (3) 1% датасет — нэгтгэсэн prior +
   вектороор татсан ижил нөхцөлтэй нэргүй пост (монгол хэллэг, контекст);
   (4) бусдын хаагдсан туршилтын үр дүн; (5) гишүүний санах ой: summary, карт,
   biz, хуучин мессежүүдээс вектороор эргэн санасан хэсэг.
   Нэг дуудлага → JSON: messages[] · axiom · draft · quick · memory · biz · log · card · test · checkin. */

const MODEL = process.env.Z_MODEL || "gpt-5.5";
const EFFORT = process.env.Z_EFFORT || "low";
const OS_TEXT = JSON.stringify(THINKING_OS);
const AX_TEXT = JSON.stringify(AXIOMS);
const AX_NAME = new Map<string, string>(AXIOMS.axioms.map((a) => [a.id, a.name_mn] as [string, string]));

const CONTRACT = `
## Owner overrides (2026-11-04) — these WIN over everything above, including the 2026-11-03 style
**Who you are now.** Z is an ecommerce and sales mentor-partner for Mongolian sellers: online shops, Facebook/Instagram pages, DM sales, TikTok, small brands, service sellers, and people choosing what to sell. Stay inside business: what to sell, offers, pricing, unit economics, customers, channels, copy, trust, operations, cash. If the member brings a non-business topic, answer it briefly like a human, then connect it to their selling. Health or crisis signals: care first, refer out, no coaching.

**Sound like a real Mongolian person chatting, not a translated bot.**
- Everyday spoken Mongolian the way people in UB actually text (learn it from <community_voice>): short sentences, natural particles (за, тэгэхээр, нээрээ, л, шүү, дээ/даа) where they fit, loanwords sellers really use (пэйж, пост, контент, inbox, захиалга, хүргэлт, сэйл, QPay).
- Never use calqued or formal bot phrases: "Таны асуултад хариулахад", "Маш сайн асуулт", "Мэдээж", "Дүгнэж хэлэхэд", "үнэ цэнийг бий болгох", "амжилт хүсье".
- Never use English labels or jargon a seller would not say: no "Metric:", "Threshold:", "conversion", "funnel", "hook", "CTA". Say the metric and the bar inside a normal sentence ("10 хүнээс 2 нь захиалбал үргэлжлүүлнэ").
- Register: mirror the member. "Та" by default; "чи" if they use чи or write casually. Latin-script Mongolian gets Latin script. At most one emoji, and only if they use emoji.
- Write like a strong Mongolian copywriter: specific nouns and numbers over adjectives; the first line hooks into their exact situation.

**Shape — like a person texting.** "messages" = 1–3 short chat bubbles, 40–90 words in total (up to 120 only when you must show a calculation). Bubble 1: their real situation in their own words (no praise). Bubble 2: the honest truth and the mechanism behind it (the axiom), plain. Bubble 3: one ≤7-day action with a metric and threshold, and/or one question. No lists, headings, markdown or bullet characters. If the message is only a greeting or has no business specifics (what they sell, price, orders, channel): exactly ONE bubble, ≤25 words — greet back like a person ("Сайн байна уу! …"), then one question about what they sell and what is stuck right now. Never say that numbers or data are missing; no test, no draft.

**Honesty — non-negotiable.**
- Tell the truth even when it is unwelcome. If their numbers lose money, say so with the arithmetic. If an idea is weak, say why in one sentence and how to make it testable.
- Never invent numbers, market sizes, statistics, prices, laws, platform rules or quotes. Use the member's numbers; anything else is labelled "таамаг" with a rough range. If you don't know, say "мэдэхгүй байна" and give the cheapest way to find out.
- No flattery, hype or income promises. Praise evidence (a sale, a reply), never intentions.

**Ground every reply in ONE axiom from <sales_axioms>** — explain the mechanism in plain words, never the textbook name; put its id in "axiom". A thinking style from thinking_os may shape the reasoning; teach it through its exemplar person only when it genuinely helps (at most one person, not every reply, exemplar story only, no invented quotes).

**Copy.** When the member asks for a post, caption, ad, DM script or reply template — or when copy IS this week's action — put ready-to-paste Mongolian text in "draft": hook in the first line → one specific benefit or proof → one clear call to action, ≤80 words, in the member's own voice. Never invent claims, reviews or numbers; use placeholders like [үнэ], [хүргэлтийн хугацаа] for facts you don't have. Keep "messages" short when you send a draft.

**Memory.** <memory_summary>, <member_card>, <business> and <recalled_from_earlier> are what you already know about THIS member from earlier conversations. Use them naturally ("Өмнө нь та … гэж байсан") and never ask again for something you already know. Return the updated "memory".

**Learning from everyone.** <what_worked> = anonymised 7-day test results from other members in similar situations: use them as evidence for odds ("ижил нөхцөлтэй хүмүүсийн туршилтаас харахад…"). <community_voice> = anonymised real posts by Mongolian members in similar situations: learn their words, context and real constraints. Never quote them, never reveal details from them, never say "another member wrote". <similar_members> = aggregate statistics for your private calibration.

## Output contract (this app)
Return ONE JSON object, nothing else, with the keys in exactly this order ("messages" first — it is streamed to the member while you write the rest):
{
  "messages": ["bubble 1", "bubble 2", "bubble 3"],
  "axiom": "id from sales_axioms.axioms",
  "style": {"id":"thinking style id","name_mn":"short Mongolian name","person":"exemplar person"} or null (null unless you taught through a person),
  "draft": {"kind":"post|caption|ad|dm|reply|other","text":"ready-to-paste copy"} or null,
  "quick": ["2–3 complete short replies the member might tap next, in their voice, ≤6 words each, no ellipses or blanks"],
  "memory": "2–4 sentences, Mongolian: everything important you now know about this member's business and journey (what they sell, to whom, numbers, what they tried, what worked, current focus). Rewrite the whole summary; keep old facts that are still true.",
  "biz": {"product":"","channel":"","price":"","volume":"","margin":"","bottleneck":""} — only fields you learned or corrected THIS turn, each ≤60 characters, in Mongolian, the member's own facts only (omit a field rather than writing 'тодорхойгүй'); product = what the business sells overall (category), never a single new item,
  "log": {"resolution_before":"L1|L2|L3|L4","resolution_target":"...","stage":"beginner|learner|doer|operator","operative_belief":"...","real_constraint":"...","chain":["style ids"],"root_cause":"...","action":"...","metric":"...","threshold":"...","due":"YYYY-MM-DD","card_overrides":[]},
  "card": {only fields learned or corrected THIS turn, same schema as <member_card>, plus "facts":["short specific facts the member stated"]},
  "test": {"action":"...","metric":"...","threshold":"...","due_days":7} or null (null when you only asked for a missing fact, or the open test is unchanged),
  "checkin": {"decision":"keep|tweak|kill","belief_update":"one sentence"} or null (only when <checkin> is present)
}`;

type Card = Record<string, unknown>;
type Biz = Record<string, string>;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const BIZ_KEYS = ["product", "channel", "price", "volume", "margin", "bottleneck"];

/** Картыг гүн нийлүүлнэ: массив → давхардалгүй нэгтгэл (facts сүүлийн 30), скаляр → шинэ утга. */
export function mergeCard(a: Card, b: Card): Card {
  const out: Card = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      const prev = Array.isArray(out[k]) ? (out[k] as unknown[]) : [];
      const seen = new Set(prev.map((x) => JSON.stringify(x)));
      const merged = [...prev, ...v.filter((x) => !seen.has(JSON.stringify(x)))];
      out[k] = k === "facts" ? merged.slice(-30) : merged.slice(-12);
    } else if (isObj(v)) out[k] = mergeCard(isObj(out[k]) ? (out[k] as Card) : {}, v);
    else out[k] = v;
  }
  return out;
}

const pick = (c: Card, path: string) => path.split(".").reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), c);

function cleanBiz(v: unknown): Biz {
  if (!isObj(v)) return {};
  const out: Biz = {};
  for (const k of BIZ_KEYS) {
    const s = typeof v[k] === "string" ? (v[k] as string).trim() : "";
    if (s && !/^(тодорхойгүй|мэдэгдэхгүй|unknown|n\/a|none|-)$/i.test(s)) out[k] = s.slice(0, 80);
  }
  return out;
}

/** Ижил archetype/resolution/stage-тай гишүүдийн нэгтгэсэн зураг (тоо ба хувь). */
export async function priors(card: Card) {
  const archetype = pick(card, "agent.archetype") as string | undefined;
  const resolution = pick(card, "cognition.resolution") as string | undefined;
  const stage = pick(card, "readiness.stage") as string | undefined;
  const tries: Record<string, string>[] = [];
  if (archetype && resolution) tries.push({ archetype, resolution });
  if (archetype) tries.push({ archetype });
  if (resolution && stage) tries.push({ resolution, stage });
  if (resolution) tries.push({ resolution });
  tries.push({});
  for (const match of tries) {
    const n = await ZPersona.countDocuments(match);
    if (n < 25) continue;
    const top = async (field: string) => {
      const rows = await ZPersona.aggregate([{ $match: match }, { $unwind: `$${field}` }, { $group: { _id: `$${field}`, c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 5 }]);
      return rows.map((r) => `${r._id} ${Math.round((r.c / n) * 100)}%`);
    };
    const [blocks, beliefs, focus, entry, drivers] = await Promise.all(["blocks", "beliefs", "focus", "entry", "drivers"].map(top));
    return { matched_on: match, members: n, blocks, beliefs, focus, entry_chain: entry, drivers };
  }
  return null;
}

/** Анхны алхамд гишүүний antaqor.com дээрх өөрийн бичвэр (bio + сүүлийн постууд) — картыг хурдан эхлүүлнэ. */
async function ownSignal(user: string) {
  const [u, posts] = await Promise.all([
    User.findById(user).select("name bio program creativeRole").lean<{ name?: string; bio?: string; program?: string; creativeRole?: string }>(),
    Post.find({ author: new Types.ObjectId(user) }).sort({ createdAt: -1 }).limit(12).select("content").lean<{ content?: string }[]>(),
  ]);
  const texts = posts.map((p) => (p.content || "").trim()).filter(Boolean).map((t) => t.slice(0, 300));
  return { name: u?.name || "", bio: (u?.bio || "").slice(0, 400), program: u?.program || "", own_posts: texts };
}

/** `messages` массивын string бүрийг бүрэн хаагдмагц нэг удаа гаргана (JSON stream-ийн хэсэгчилсэн буферээс). */
function bubbleScanner(onBubble: (text: string, i: number) => void) {
  let emitted = 0;
  let closed = false;
  return (buf: string) => {
    if (closed) return;
    const k = buf.indexOf('"messages"');
    if (k < 0) return;
    let i = buf.indexOf("[", k);
    if (i < 0) return;
    i++;
    for (let n = 0; ; n++) {
      while (i < buf.length && /[\s,]/.test(buf[i])) i++;
      if (i >= buf.length) return;
      if (buf[i] === "]") { closed = true; return; }
      if (buf[i] !== '"') { closed = true; return; }
      let j = i + 1;
      for (let esc = false; j < buf.length; j++) {
        if (esc) esc = false;
        else if (buf[j] === "\\") esc = true;
        else if (buf[j] === '"') break;
      }
      if (j >= buf.length) return;
      if (n >= emitted) {
        emitted = n + 1;
        try { const t = String(JSON.parse(buf.slice(i, j + 1))).trim(); if (t) onBubble(t, n); } catch { /* хагас тэмдэгт */ }
      }
      i = j + 1;
    }
  };
}

/* Нийлүүлэгчийн дараалал: OpenAI (Z_MODEL) → Gemini (Z_GEMINI_MODEL). Хоёулаа OpenAI-нийцтэй
   chat-completions + SSE stream. Төлбөр/эрхийн алдаа (401/402/403, кредит/квот дууссан) гарвал тэр
   нийлүүлэгчийг 10 мин алгасна — OpenAI-д кредит нэмэгдэхэд өөрөө эргэж ирнэ. Бөмбөлөг гаргаж
   эхэлсний дараа солихгүй (давхар бөмбөлөг гарна). 2026-11-04: OpenAI кредит дууссан. */
type Prov = { name: string; url: string; key?: string; model: string; extra: Record<string, unknown> };
const provs = (): Prov[] => [
  { name: "openai", url: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, model: MODEL, extra: { reasoning_effort: EFFORT, max_completion_tokens: 4000 } },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", key: process.env.GEMINI_API_KEY, model: process.env.Z_GEMINI_MODEL || "gemini-3-flash-preview", extra: { reasoning_effort: "low", max_tokens: 4000 } },
].filter((p) => !!p.key);
const downUntil = new Map<string, number>();
class ProvError extends Error { constructor(msg: string, public billing: boolean) { super(msg); } }

/** Нэг нийлүүлэгч. onBubble өгвөл stream-ээр уншиж, хариултын бөмбөлөг бүрийг бэлэн болмогц дамжуулна. */
async function callOne(p: Prov, messages: unknown[], onBubble?: (text: string, i: number) => void): Promise<string> {
  const body = { model: p.model, messages, response_format: { type: "json_object" }, ...p.extra };
  const r = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(onBubble ? { ...body, stream: true, ...(p.name === "openai" ? { stream_options: { include_usage: true } } : {}) } : body),
    signal: AbortSignal.timeout(110_000),
  });
  if (!r.ok || !onBubble || !r.body) {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = String(d?.error?.message || d?.[0]?.error?.message || r.status);
      throw new ProvError(`${p.name}: ${m.slice(0, 160)}`, [401, 402, 403].includes(r.status) || /credit|quota|billing|exceeded/i.test(m));
    }
    if (process.env.Z_DEBUG) console.log("[z usage]", p.name, JSON.stringify(d?.usage));
    return String(d?.choices?.[0]?.message?.content || "");
  }
  const scan = bubbleScanner(onBubble);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let sse = "";
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    sse += dec.decode(value, { stream: true });
    for (let nl = sse.indexOf("\n"); nl >= 0; nl = sse.indexOf("\n")) {
      const line = sse.slice(0, nl).trim();
      sse = sse.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const c = j?.choices?.[0]?.delta?.content;
        if (c) { out += c; scan(out); }
        if (j?.usage && process.env.Z_DEBUG) console.log("[z usage]", p.name, JSON.stringify(j.usage));
      } catch { /* дутуу мөр */ }
    }
  }
  return out;
}

async function complete(messages: unknown[], onBubble?: (text: string, i: number) => void): Promise<{ text: string; provider: string }> {
  let emitted = 0;
  const relay = onBubble ? (t: string, i: number) => { emitted++; onBubble(t, i); } : undefined;
  let last: Error | null = null;
  for (const p of provs()) {
    if ((downUntil.get(p.name) || 0) > Date.now()) continue;
    try {
      return { text: await callOne(p, messages, relay), provider: p.name };
    } catch (e) {
      last = e as Error;
      console.error("[z]", last.message);
      if (e instanceof ProvError && e.billing) downUntil.set(p.name, Date.now() + 10 * 60e3);
      if (emitted) throw last;
    }
  }
  if (last) console.error("[z] бүх нийлүүлэгч унасан");
  throw new Error("Z түр ажиллахгүй байна. Хэсэг хугацааны дараа дахин бичээрэй.");
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

type MsgRow = {
  _id: unknown; role: string; text: string; createdAt: Date;
  log?: { style?: { name_mn?: string; person?: string } | null; axiom?: string; parts?: string[]; draft?: { kind?: string; text?: string } | null; quick?: string[] };
};

export async function state(user: string) {
  await dbConnect();
  const uid = new Types.ObjectId(user);
  const [c, msgs, tests, u] = await Promise.all([
    ZCard.findOne({ user: uid }).lean(),
    ZMsg.find({ user: uid }).sort({ createdAt: -1 }).limit(80).select("role text createdAt log.style log.axiom log.parts log.draft log.quick").lean<MsgRow[]>(),
    ZTest.find({ user: uid }).sort({ createdAt: -1 }).limit(10).lean(),
    User.findById(uid).select("name").lean<{ name?: string }>(),
  ]);
  const card = (c?.card as Card) || {};
  const rows = msgs.reverse();
  return {
    name: (u?.name || "").split(/\s+/)[0] || "",
    card,
    memory: c?.summary || "",
    biz: (isObj(card.biz) ? card.biz : {}) as Biz,
    turns: c?.turns || 0,
    messages: rows.map((m, i) => {
      const L = m.log || {};
      const parts = Array.isArray(L.parts) && L.parts.length ? L.parts.map(String) : [m.text];
      return {
        id: String(m._id), role: m.role, parts, at: m.createdAt,
        axiom: L.axiom && AX_NAME.has(L.axiom) ? { id: L.axiom, name: AX_NAME.get(L.axiom)! } : undefined,
        style: L.style?.person ? { name: String(L.style.name_mn || ""), person: String(L.style.person) } : undefined,
        draft: L.draft?.text ? { kind: String(L.draft.kind || "other"), text: String(L.draft.text) } : undefined,
        quick: i === rows.length - 1 && Array.isArray(L.quick) ? L.quick.map(String).slice(0, 3) : undefined,
      };
    }),
    tests: (tests as { _id: unknown }[]).map((t) => ({ ...t, _id: String(t._id) })),
  };
}

/** Бүгдийг мартуулах: яриа, карт, туршилт, вектор (бусдад суралцуулсан үр дүн ч мөн). */
export async function forget(user: string) {
  await dbConnect();
  const uid = new Types.ObjectId(user);
  await Promise.all([ZMsg.deleteMany({ user: uid }), ZCard.deleteOne({ user: uid }), ZTest.deleteMany({ user: uid }), forgetUser(user)]);
  return state(user);
}

const hits = (a: Hit[], n: number) => a.map((h) => h.text.slice(0, n));

/** Нэг яриа. checkin = {testId, value} бол 7 хоногийн үр дүнг дүгнэнэ. onBubble — stream (бөмбөлөг бүр бэлэн болмогц). */
export async function turn(o: { user: string; message: string; checkin?: { testId: string; value: string } | null }, onBubble?: (text: string, i: number) => void) {
  await dbConnect();
  const uid = new Types.ObjectId(o.user);
  const cardDoc = (await ZCard.findOne({ user: uid }).lean()) || { card: {}, summary: "", turns: 0 };
  const card = (cardDoc.card || {}) as Card;
  const biz = (isObj(card.biz) ? card.biz : {}) as Biz;
  const bizLine = BIZ_KEYS.filter((k) => biz[k]).map((k) => `${k}: ${biz[k]}`).join("; ");
  const query = [o.message, bizLine, (cardDoc.summary || "").slice(0, 300)].filter(Boolean).join("\n");

  const [history, open, past, prior, own, vecs] = await Promise.all([
    ZMsg.find({ user: uid }).sort({ createdAt: -1 }).limit(16).select("role text").lean<{ role: string; text: string }[]>(),
    ZTest.find({ user: uid, status: "open" }).sort({ createdAt: -1 }).limit(3).lean<{ _id: Types.ObjectId; action: string; metric: string; threshold: string; due: Date }[]>(),
    ZTest.find({ user: uid, status: { $in: ["keep", "tweak", "kill"] } }).sort({ updatedAt: -1 }).limit(5).select("action metric threshold value status beliefUpdate").lean<{ action: string; metric: string; threshold: string; value: string; status: string; beliefUpdate: string }[]>(),
    priors(card),
    (cardDoc.turns || 0) < 3 ? ownSignal(o.user) : Promise.resolve(null),
    embedPair(query, o.message),
  ]);
  const recent = new Set(history.map((m) => m.text));
  const mem = vecs ? await retrieve(o.user, vecs, recent).catch(() => null) : null;

  let checkTest: (typeof open)[number] | null = null;
  if (o.checkin && Types.ObjectId.isValid(o.checkin.testId)) {
    checkTest = (await ZTest.findOne({ _id: o.checkin.testId, user: uid, status: "open" }).lean<(typeof open)[number]>()) || null;
  }

  const ctx = [
    `<today>${ymd(new Date())}</today>`,
    `<memory_summary>${cardDoc.summary || "(new member — nothing remembered yet)"}</memory_summary>`,
    `<business>${bizLine || "(unknown yet)"}</business>`,
    `<member_card>${JSON.stringify(card)}</member_card>`,
    mem?.recalled.length ? `<recalled_from_earlier note="the member's own older messages that match this topic">${JSON.stringify(mem.recalled.map((h) => ({ at: ymd(new Date(h.meta.at as string)), text: h.text.slice(0, 400) })))}</recalled_from_earlier>` : "",
    past.length ? `<own_past_tests>${JSON.stringify(past.map((t) => ({ action: t.action, metric: t.metric, threshold: t.threshold, result: t.value, decision: t.status, learned: t.beliefUpdate })))}</own_past_tests>` : "",
    own ? `<member_own_antaqor_posts note="the member's own earlier writing on antaqor.com; signal for the card, do not quote back">${JSON.stringify(own)}</member_own_antaqor_posts>` : "",
    mem?.outcome.length ? `<what_worked note="anonymised 7-day test results of other members in similar situations">${JSON.stringify(hits(mem.outcome, 500))}</what_worked>` : "",
    mem?.voice.length ? `<community_voice note="anonymised posts by Mongolian members in similar situations — learn words and context, never quote or reveal">${JSON.stringify(hits(mem.voice, 450))}</community_voice>` : "",
    prior ? `<similar_members note="aggregate of the 1% dataset, private calibration only">${JSON.stringify(prior)}</similar_members>` : "",
    open.length ? `<open_tests>${JSON.stringify(open.map((t) => ({ id: String(t._id), action: t.action, metric: t.metric, threshold: t.threshold, due: ymd(t.due) })))}</open_tests>` : "<open_tests>none</open_tests>",
    checkTest ? `<checkin test="${String(checkTest._id)}">action: ${checkTest.action}\nmetric: ${checkTest.metric}\nthreshold (agreed beforehand, never move it): ${checkTest.threshold}\nreported value: ${o.checkin!.value}</checkin>` : "",
  ].filter(Boolean).join("\n");

  /* НЭГ system мессеж: Gemini-ийн OpenAI давхарга олон system-ээс зөвхөн сүүлийнхийг авдаг.
     Тогтмол хэсэг эхэндээ тул OpenAI-ийн prompt cache хэвээр ажиллана. */
  const messages = [
    { role: "system", content: `${MENTOR_PROMPT}\n\n<thinking_os>${OS_TEXT}</thinking_os>\n<sales_axioms>${AX_TEXT}</sales_axioms>\n${CONTRACT}\n\n${ctx}` },
    ...history.reverse().map((m) => ({ role: m.role === "agent" ? "assistant" : "user", content: m.text })),
    { role: "user", content: o.message },
  ];

  const { text: raw, provider } = await complete(messages, onBubble);
  type Out = {
    messages?: unknown; reply?: string; axiom?: string; style?: { id?: string; name_mn?: string; person?: string } | null;
    draft?: { kind?: string; text?: string } | null; quick?: unknown; memory?: string; biz?: unknown;
    log?: Record<string, unknown>; card?: Card; test?: { action?: string; metric?: string; threshold?: string; due_days?: number } | null;
    checkin?: { decision?: string; belief_update?: string } | null;
  };
  let out: Out = {};
  try { out = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { out = { reply: raw }; }
  let parts = (Array.isArray(out.messages) ? out.messages : [out.reply]).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 3);
  if (!parts.length) parts = ["Уучлаарай, хариулт гарсангүй. Дахиад бичээд үзээрэй."];
  const draft = out.draft && String(out.draft.text || "").trim() ? { kind: String(out.draft.kind || "other").slice(0, 20), text: String(out.draft.text).trim().slice(0, 2000) } : null;
  const quick = Array.isArray(out.quick) ? out.quick.map((x) => String(x || "").trim().slice(0, 60)).filter(Boolean).slice(0, 3) : [];
  const axiom = typeof out.axiom === "string" && AX_NAME.has(out.axiom) ? out.axiom : undefined;

  const userMsg = await ZMsg.create({ user: uid, role: "user", text: o.message.slice(0, 6000) });
  await ZMsg.create({
    user: uid, role: "agent", text: parts.join("\n\n").slice(0, 6000),
    log: { ...(isObj(out.log) ? out.log : {}), style: isObj(out.style) && out.style.person ? out.style : null, axiom, parts, draft, quick, provider },
  });
  if (vecs) await rememberMsg(o.user, String(userMsg._id), o.message, vecs).catch(() => {});

  const merged = mergeCard(card, isObj(out.card) ? out.card : {});
  merged.biz = { ...biz, ...cleanBiz(out.biz) };
  const summary = typeof out.memory === "string" && out.memory.trim() ? out.memory.trim().slice(0, 1500) : cardDoc.summary || "";
  await ZCard.updateOne({ user: uid }, { $set: { card: merged, summary }, $inc: { turns: 1 } }, { upsert: true });

  if (checkTest && out.checkin?.decision && ["keep", "tweak", "kill"].includes(out.checkin.decision)) {
    const belief = String(out.checkin.belief_update || "").slice(0, 400);
    await ZTest.updateOne({ _id: checkTest._id }, { $set: { status: out.checkin.decision, value: o.checkin!.value.slice(0, 200), beliefUpdate: belief } });
    /* Бүх гишүүнд суралцах мөр: нөхцөл (бизнесийн төрөл, суваг, шат) + туршилт + үр дүн. */
    const b = merged.biz as Biz;
    const stage = String(pick(merged, "readiness.stage") || "");
    const situation = [b.product, b.channel, stage].filter(Boolean).join(", ");
    await rememberOutcome(o.user, String(checkTest._id),
      `Нөхцөл: ${situation || "тодорхойгүй"}. Туршилт: ${checkTest.action}. Хэмжүүр: ${checkTest.metric}; босго: ${checkTest.threshold}. Үр дүн: ${o.checkin!.value} → ${out.checkin.decision}. Сургамж: ${belief}`,
      { decision: out.checkin.decision, stage },
    ).catch(() => {});
  }
  const t = out.test;
  if (t && t.action && String(t.action).trim()) {
    /* Нэг удаад нэг нээлттэй туршилт — хуучин нээлттэйг «орхисон» болгоно (check-in хийгээгүй бол). */
    await ZTest.updateMany({ user: uid, status: "open", ...(checkTest ? { _id: { $ne: checkTest._id } } : {}) }, { $set: { status: "dropped" } });
    const days = Math.min(14, Math.max(1, Number(t.due_days) || 7));
    await ZTest.create({ user: uid, action: String(t.action).slice(0, 500), metric: String(t.metric || "").slice(0, 200), threshold: String(t.threshold || "").slice(0, 200), due: new Date(Date.now() + days * 86400e3) });
  }
  return state(o.user);
}
