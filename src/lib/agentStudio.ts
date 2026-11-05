import { randomUUID } from "crypto";
import { unlink } from "fs/promises";
import mongoose, { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { TuqorConfig, TuqorPost, TuqorVec, type ITuqorPost, type TuqorFormat } from "@/models/Tuqor";
import { AgentNote, AgentAudience, AgentProduct, AgentRule, AgentMedia, AgentPersona, AgentWardrobe, type IAgentRule, type IAgentMedia, type DetectedItem } from "@/models/AgentStudio";
import { readFile } from "fs/promises";
import sharp from "sharp";
import { hfModel, hfCost, hfSubmit, hfStatus, hfSave, hfReady, siteUrl, saveBuffer, type Opts as HfOpts } from "@/lib/hfMedia";
import { generateNanoBanana, geminiImageKey } from "@/lib/nanoBanana";
import { AUTO, autoPick, imgCost, imgModel, imgNorm } from "@/lib/agentImageModels";
import SocialPost from "@/models/SocialPost";
import SocialInsight from "@/models/SocialInsight";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { buildVoicePrompt, ANGLES } from "@/lib/threadsVoice";
import { EMB_MODEL, embedMany, embedQuery } from "@/lib/embeddings";
import { SUPER_ADMIN_EMAILS } from "@/lib/adminAuth";
import { getConfig, syncVectors, predict, guard, voicePosts, allowedCtas, schedule, lessons, busyTimes, ASKS, MAIN_WS } from "@/lib/tuqor";
import { getBusiness, useGen, planOf } from "@/lib/agentWs";
import { chargeStudio, refundCharge, refundFailedStudio, studioPayer } from "@/lib/studioCredits";
import { AgentWorkspace } from "@/models/AgentWorkspace";
import { renderInfographic, type IgSpec, type IgTheme } from "@/lib/agentInfographic";
import { IMAGE_PRESETS, MOTION_PRESETS, PERSONA_SHEET, packFor, defaultItem, type Category } from "@/lib/studioPresets";
import { twinPrompt, TWIN_SHEETS, DEFAULT_WARDROBE, type TwinProfile, type TwinSheet, type TwinStyle, type TwinPalette, type TwinExpr } from "@/lib/twinPresets";
import { DAY, ub, ubAt, ubDayStart, ymd } from "@/lib/contentAgentRules";

/* ─── ANTAQOR AGENT — студийн давхарга (2026-10-23) ──────────────────────
   Санаа / зураг / Threads-ийн сайн пост / тэмдэглэл / бүтээгдэхүүн
     → хэд хэдэн ХУВИЛБАР (санал биш — бэлэн контент)
     → үсгийн алдаа засах + generic хэллэг хасах
     → audience-д тааруулах, эзний сэтгэлгээ (cognitive профайл) + тэмдэглэлийн хэв маяг
     → vector тест (таамаг, шинэлэг байдал) → infographic зурах
     → нийтлэх / товлох. Хуваарийн дүрэм (өдөр бүр 08:00 …) ба цаг тутмын хяналт
       нь ялсан постыг шинэчилж дахин нийтэлнэ. */

export const AGENT_NAME = "Antaqor Agent";
type PostL = Omit<ITuqorPost, keyof import("mongoose").Document> & { _id: Types.ObjectId };
type RuleL = Omit<IAgentRule, keyof import("mongoose").Document> & { _id: Types.ObjectId };
type MediaL = Omit<IAgentMedia, keyof import("mongoose").Document> & { _id: Types.ObjectId };
export const GENERIC_DEFAULT = [
  "өнөөдрийн ертөнцөд", "технологи хурдацтай", "орчин үеийн нийгэмд", "ai бол ирээдүй", "ирээдүй энд байна", "game changer", "тууштай байгаарай",
  "хэзээ ч бүү бууж өг", "амжилтын түлхүүр", "өөрийгөө хөгжүүл", "боломж хязгааргүй", "шинэ эрин", "дараагийн түвшинд", "next level", "unlock",
  "цаг үеэ дагаж", "маш их ач холбогдолтой", "та бүхэнд", "санал болгож байна", "нэгдээрэй", "хамтдаа хөгжье",
];

/* ─── AI ───────────────────────────────────────────────────────────────── */
const WRITER = () => process.env.TUQOR_MODEL || process.env.THREADS_WRITER_MODEL || "gpt-5.4";
async function llm(system: string, user: string, maxTokens = 3200, temperature = 0.9): Promise<{ text: string; model: string }> {
  const fails: string[] = [];
  for (const p of providers().map((x) => (x.name === "openai" ? { ...x, model: WRITER() } : x))) {
    try {
      const c = await chatCompletion(p, [{ role: "system", content: system }, { role: "user", content: user }], { maxTokens, temperature, reasoning: "none", timeoutMs: 120_000, onAttempt: (a) => { if (!a.ok) fails.push(`${a.name}: ${a.code || a.status || ""}`); } });
      const t = String(c?.message?.content || "").trim();
      if (t) return { text: t, model: `${p.name}:${p.model}` };
    } catch (e) { fails.push(`${p.name}: ${(e as Error).message}`); }
  }
  throw new Error(`AI хариу өгсөнгүй — ${fails.slice(0, 3).join(" · ")}`);
}
function json<T>(raw: string, fallback: T): T {
  const s = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const a = Math.min(...["[", "{"].map((c) => (s.indexOf(c) < 0 ? 1e9 : s.indexOf(c))));
  const b = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  try { return JSON.parse(a < 1e9 ? s.slice(a, b + 1) : s) as T; } catch { return fallback; }
}

/* ─── Үсэг засах + generic хасах ───────────────────────────────────────── */
export function genericHits(text: string, list: string[]): string[] {
  const t = text.toLowerCase();
  return Array.from(new Set(list.map((g) => g.trim().toLowerCase()).filter((g) => g && t.includes(g))));
}
export async function polish(texts: string[], opts: { spell: boolean; generic: string[] }): Promise<{ text: string; fixes: { from: string; to: string }[]; generic: string[] }[]> {
  if (!texts.length) return [];
  const hits = texts.map((t) => genericHits(t, opts.generic));
  if (!opts.spell && hits.every((h) => !h.length)) return texts.map((t) => ({ text: t, fixes: [], generic: [] }));
  const system = `Чи Монгол хэлний нарийн редактор. Хоёр л ажил хийнэ:
1) ${opts.spell ? "Үсгийн алдаа, кирилл/латин холилдсон үсэг, давхар зай, буруу цэг таслалыг засна." : "Үсгийг ХӨНДӨХГҮЙ."}
2) Generic, хоосон, хэн ч бичиж болох хэллэгийг (доорх жагсаалт ба түүнтэй адил) тодорхой, бодит, хувийн хэллэгээр СОЛЬНО эсвэл ХАСНА.
ХАТУУ: мөрийн бүтэц, мөр таслалт, өнгө аяс, англи нэр томьёо (AI, creator, prompt, agent, system…), emoji, CTA мөрийг ӨӨРЧЛӨХГҮЙ. Шинэ санаа нэмэхгүй.
Generic жагсаалт: ${opts.generic.join("; ")}
Зөвхөн JSON массив: [{"i":0,"text":"засварласан бүтэн текст","fixes":[{"from":"буруу","to":"зөв"}],"generic":["хассан/сольсон хэллэг"]}]`;
  const user = texts.map((t, i) => `### ${i}\n${t}`).join("\n\n");
  try {
    const r = await llm(system, user, Math.min(6000, 600 + texts.join("").length * 2), 0.2);
    const arr = json<{ i: number; text: string; fixes?: { from: string; to: string }[]; generic?: string[] }[]>(r.text, []);
    return texts.map((t, i) => {
      const x = arr.find((a) => Number(a.i) === i);
      const out = String(x?.text || "").trim();
      /* редактор хэт их өөрчилсөн (урт 40%+ зөрсөн) бол эхийг үлдээнэ */
      const ok = out && Math.abs(out.length - t.length) / Math.max(1, t.length) < 0.4;
      return ok ? { text: out, fixes: (x?.fixes || []).filter((f) => f.from && f.to && f.from !== f.to).slice(0, 12), generic: Array.from(new Set([...(x?.generic || []), ...hits[i]])).slice(0, 8) } : { text: t, fixes: [], generic: hits[i] };
    });
  } catch { return texts.map((t, i) => ({ text: t, fixes: [], generic: hits[i] })); }
}

/* ─── Зургаас санаа ────────────────────────────────────────────────────── */
export async function imageIdea(dataUrl: string): Promise<{ idea: string; points: string[]; kind: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI тохируулаагүй");
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl) || dataUrl.length > 4_500_000) throw new Error("Зураг буруу эсвэл хэт том");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: process.env.AGENT_VISION_MODEL || WRITER(), max_completion_tokens: 1200, reasoning_effort: "none",
      messages: [{ role: "user", content: [
        { type: "text", text: "Энэ зургийг (infographic, screenshot, слайд, гэрэл зураг) уншиж, AI creator-ын сошиал контентод ашиглах гол санааг Монголоор гарга. Зурган дээрх бичгийг үнэн зөв уншина, зохиохгүй. Зөвхөн JSON: {\"idea\":\"нэг өгүүлбэрт гол санаа\",\"points\":[\"зурган дахь 3-7 гол санаа/алхам, тус бүр богино\"],\"kind\":\"infographic|screenshot|photo|slide\"}" },
        { type: "image_url", image_url: { url: dataUrl } },
      ] }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Зураг уншиж чадсангүй: ${d?.error?.message || r.status}`);
  const j = json<{ idea?: string; points?: string[]; kind?: string }>(String(d?.choices?.[0]?.message?.content || ""), {});
  if (!j.idea) throw new Error("Зурагнаас санаа гарсангүй");
  return { idea: String(j.idea), points: (j.points || []).map(String).slice(0, 8), kind: String(j.kind || "") };
}

/* ─── Тэмдэглэл → vector + сэтгэлгээний профайл ────────────────────────── */
export async function embedNotes(ws: string = MAIN_WS): Promise<number> {
  const notes = await AgentNote.find({ ws }).select("title body updatedAt").lean();
  const have = new Map((await TuqorVec.find({ source: "note", ws }).select("key text embModel").lean<{ key: string; text: string; embModel: string }[]>()).map((r) => [r.key, r]));
  const need = notes.map((n) => ({ key: `note_${n._id}`, text: `${n.title}\n${n.body}`.trim(), at: n.updatedAt })).filter((n) => n.text.length > 10 && (have.get(n.key)?.text !== n.text || have.get(n.key)?.embModel !== EMB_MODEL));
  for (let i = 0; i < need.length; i += 96) {
    const b = need.slice(i, i + 96); const v = await embedMany(b.map((x) => x.text));
    await TuqorVec.bulkWrite(b.map((x, j) => ({ updateOne: { filter: { key: x.key }, update: { $set: { ws, text: x.text, v: v[j], embModel: EMB_MODEL, platform: "note", source: "note" as const, score: 0, postedAt: x.at } }, upsert: true } })));
  }
  const ids = new Set(notes.map((n) => `note_${n._id}`));
  const stale = [...have.keys()].filter((k) => !ids.has(k));
  if (stale.length) await TuqorVec.deleteMany({ key: { $in: stale } });
  return need.length;
}
async function similarNotes(q: string, ws: string, k = 4): Promise<string[]> {
  if (!q.trim()) return (await AgentNote.find({ ws }).sort({ updatedAt: -1 }).limit(k).lean()).map((n) => `${n.title}\n${n.body}`.slice(0, 600));
  const rows = await TuqorVec.find({ source: "note", ws, embModel: EMB_MODEL }).select("+v text").lean<{ text: string; v: number[] }[]>();
  if (!rows.length) return [];
  const qv = await embedQuery(q);
  return rows.map((r) => ({ t: r.text, s: r.v.reduce((a, x, i) => a + x * qv[i], 0) })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.t.slice(0, 600));
}
export async function buildCognitive(ws: string = MAIN_WS) {
  await dbConnect();
  await useGen(ws);
  const cfg = await getConfig(ws);
  const [notes, top] = await Promise.all([
    AgentNote.find({ ws }).sort({ updatedAt: -1 }).limit(40).lean(),
    TuqorVec.find({ ws, source: "own", platform: "threads" }).sort({ score: -1 }).limit(14).select("text score").lean<{ text: string; score: number }[]>(),
  ]);
  if (!notes.length && !top.length) throw new Error("Тэмдэглэл, пост алга — эхлээд тэмдэглэл бичнэ үү");
  const r = await llm(
    "Чи хүний бичвэрээс түүний СЭТГЭЛГЭЭ, ХЭВ МАЯГИЙГ задлах шинжээч. Зөвхөн өгсөн бичвэрт тулгуурла, зохиохгүй. Монголоор. Зөвхөн JSON.",
    `ЭЗНИЙ ТЭМДЭГЛЭЛҮҮД:\n${notes.map((n) => `— ${n.title}\n${n.body.slice(0, 700)}`).join("\n\n") || "алга"}\n\nХАМГИЙН ИХ ХАНДАЛТ АВСАН THREADS ПОСТУУД:\n${top.map((t) => `[${t.score}] ${t.text.slice(0, 300)}`).join("\n\n")}\n\nЭЗНИЙ ЖИШЭЭ:\n${(cfg.examples || []).join("\n")}\n\n` +
      `JSON: {"summary":"энэ хүн юу гэж боддог, хэрхэн бичдэг — 2-3 өгүүлбэр","beliefs":["тогтвортой итгэл үнэмшил ×5"],"frames":["давтагддаг сэтгэлгээний хүрээ/бүтэц ×5 (жишээ: эсрэгцүүлэл, тоотой түүх)"],"vocabulary":["түүний байнга хэрэглэдэг үг, хэллэг ×12"],"tone":"өнгө аяс 1 өгүүлбэр","avoid":["тэр хэзээ ч бичихгүй зүйл ×5"]}`,
    2500, 0.3
  );
  const j = json<{ summary?: string; beliefs?: string[]; frames?: string[]; vocabulary?: string[]; tone?: string; avoid?: string[] }>(r.text, {});
  const cognitive = { summary: String(j.summary || ""), beliefs: (j.beliefs || []).map(String).slice(0, 6), frames: (j.frames || []).map(String).slice(0, 6), vocabulary: (j.vocabulary || []).map(String).slice(0, 16), tone: String(j.tone || ""), avoid: (j.avoid || []).map(String).slice(0, 6), updatedAt: new Date() };
  await TuqorConfig.updateOne({ key: ws }, { $set: { cognitive } });
  return cognitive;
}

/* ─── Контекст блок (бүх бичилтэд) ───────────────────────────────────────── */
async function contextBlock(opts: { ws: string; idea: string; audienceId?: string; productId?: string; withProducts?: boolean }) {
  const ws = opts.ws;
  const cfg = await getConfig(ws);
  /* Нөхцөлт Mongoose query-уудыг Promise.all-д union болгох нь TypeScript-ийг (build) санах ойгоор
     дүүргэдэг — тиймээс тодорхой төрөлтэй, дараалсан хүлээлт. */
  type AudL = { name: string; who: string; pains: string; desires: string; level: string };
  type ProdL = { name: string; pitch: string; price: string; link: string; cta: string };
  const recent = await voicePosts(ws);
  const ctas = await allowedCtas(cfg, ws);
  const top = await TuqorVec.find({ ws, source: "own", platform: "threads" }).sort({ score: -1 }).limit(6).select("text score").lean<{ text: string; score: number }[]>();
  const aud: AudL | null = opts.audienceId ? await AgentAudience.findOne({ _id: opts.audienceId, ws }).lean<AudL>() : await AgentAudience.findOne({ ws, isDefault: true }).lean<AudL>();
  let prods: ProdL[] = [];
  if (opts.productId) prods = await AgentProduct.find({ _id: opts.productId, ws }).lean<ProdL[]>();
  else if (opts.withProducts) prods = await AgentProduct.find({ ws, active: true }).limit(6).lean<ProdL[]>();
  const notes: string[] = await similarNotes(opts.idea, ws).catch(() => []);
  const learned = await lessons(ws);
  const c = cfg.cognitive;
  const biz = ws === MAIN_WS ? null : await getBusiness(ws);
  const voice = biz ? bizVoice(biz, recent) : buildVoicePrompt(recent);
  const system = `${voice}

─── ${AGENT_NAME.toUpperCase()} ───
Чи бол ${biz ? `«${biz.name}»-ийн контент агент — бизнесийн нэрийн өмнөөс, түүний дуу хоолойгоор бичнэ` : `${AGENT_NAME} — эзний нэрээр, ЯГ түүний дуу хоолой, сэтгэлгээгээр бичдэг контент агент`}.
Дээрх «Урт: 150-400» дүрэм зөвхөн задлал (value) хэлбэрт. Худал баримт, зохиомол тоо, огноо, хямдрал, амлалт, зохиомол хүн/уулзалт/үйлчлүүлэгчийн түүх ЗОХИОХГҮЙ — эзний санаа, тэмдэглэлд байвал л ашиглана.
Generic, хэн ч бичиж болох хэллэг ХОРИГЛОНО: ${(cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT).join("; ")}${c?.summary ? `

ЭЗНИЙ СЭТГЭЛГЭЭ (cognitive профайл — үүгээр бод):
${c.summary}
Итгэл үнэмшил: ${(c.beliefs || []).join("; ")}
Сэтгэлгээний хүрээ: ${(c.frames || []).join("; ")}
Түүний үгс: ${(c.vocabulary || []).join(", ")}
Өнгө аяс: ${c.tone}
Хэзээ ч: ${(c.avoid || []).join("; ")}` : ""}`;
  const parts = [
    (cfg.examples || []).length ? `ЭЗНИЙ ЖИШЭЭ (өнгө аяс, эрч хүч):\n${cfg.examples.map((e) => `«${e}»`).join("\n")}` : "",
    notes.length ? `ЭЗНИЙ ТЭМДЭГЛЭЛЭЭС (хэв маяг, сэтгэлгээ — сэдэвт ойр):\n${notes.map((n) => `«${n.replace(/\s+/g, " ").slice(0, 400)}»`).join("\n")}` : "",
    aud ? `ЗОРИЛТОТ AUDIENCE: ${aud.name} — ${aud.who}. Өвдөлт: ${aud.pains}. Хүсэл: ${aud.desires}. Түвшин: ${aud.level}. Энэ хүн рүү шууд ярь, түүний хэлээр.` : "",
    prods.length ? `САНАЛ БОЛГОХ БҮТЭЭГДЭХҮҮН (зөвхөн энэ баримтаар):\n${prods.map((p) => `· ${p.name} — ${p.pitch}${p.price ? ` · Үнэ: ${p.price}` : ""}${p.link ? ` · ${p.link}` : ""}${p.cta ? ` · CTA: ${p.cta}` : ""}`).join("\n")}` : "",
    `CTA сонголт (сүүлийн мөр — яг үгээр нь, эсвэл маш ойрхон):\n${ctas.map((x) => `· ${x}`).join("\n")}`,
    top.length ? `ХАМГИЙН ИХ ХАНДАЛТ АВСАН ПОСТУУД (хэлбэрийг дуурай, сэдвийг биш):\n${top.map((t) => `[${t.score}] ${t.text.replace(/\s+/g, " ").slice(0, 220)}`).join("\n")}` : "",
    learned.length ? `ТЕСТИЙН ДҮГНЭЛТ:\n${learned.join("\n")}` : "",
  ].filter(Boolean);
  return { cfg, system, context: parts.join("\n\n"), audience: aud?.name || "", biz };
}

/* Түрээслэгчийн дуу хоолой — Antaqor-ийн VOICE_SPEC (хувь хүн, «чи», AI creator) ОГТ ашиглахгүй.
   Бизнесийн танилцуулга + өөрийн Threads постууд (байвал) + энгийн, ойлгомжтой дүрэм. */
type Biz = { name: string; about: string; audience: string; tone: string; brandColor: string; website: string; contact: string };
function bizVoice(b: Biz, recent: { text: string }[]): string {
  const samples = recent.map((r) => (r.text || "").trim()).filter((t) => t.length >= 40).slice(0, 10);
  return `Чи бол «${b.name}»-ийн сошиал хуудсыг хөтөлдөг туршлагатай контент мэргэжилтэн. Бизнесийн нэрийн өмнөөс Монгол хэлээр бичнэ.

БИЗНЕС: ${b.about || "—"}
ХЭРЭГЛЭГЧИД: ${b.audience || "ерөнхий олон нийт"}
ӨНГӨ АЯС: ${b.tone || "найрсаг, ойлгомжтой, итгэл төрүүлэхүйц"}${b.website ? `
ВЭБ: ${b.website}` : ""}${b.contact ? `
ХОЛБОО БАРИХ: ${b.contact}` : ""}

ДҮРЭМ
- Энгийн, тод, ямар ч насны хүн нэг уншаад ойлгох хэлээр. Богино мөр, нэг мөр нэг санаа.
- Эхний мөр — анхаарал татах hook (асуулт, тод баримт, хэрэглэгчийн асуудал).
- Зөвхөн дээрх танилцуулга, бүтээгдэхүүний баримтаар. Үнэ, хямдрал, огноо, хаяг, утас, тоо, үйлчлүүлэгчийн сэтгэгдэл ЗОХИОХГҮЙ.
- Emoji 0–2, hashtag 0–2. Сүүлийн мөр — тодорхой уриалга (CTA).
- Хэтэрхий зар сурталчилгааны, хоосон магтаал бүхий хэллэг хэрэглэхгүй — хэрэгтэй, үнэ цэнтэй мэдээлэл өг.${samples.length ? `

ЭНЭ БИЗНЕСИЙН ӨМНӨХ ПОСТУУД (хэлбэр, өнгө аясыг дуурай, сэдвийг БИШ):
${samples.map((t, i) => `--- ${i + 1} ---\n${t}`).join("\n\n")}` : ""}`;
}

/* ─── Хувилбар бүтээх ─────────────────────────────────────────────────── */
export type CreateInput = {
  source: "idea" | "image" | "top" | "note" | "product";
  text?: string; imageDataUrl?: string; postKey?: string; noteId?: string; productId?: string;
  audienceId?: string; format: "post" | "infographic" | "image" | "video"; count?: number; platforms?: string[]; theme?: IgTheme;
  /** AI зураг/видео: загвар, харьцаа, чанар, урт. mediaFor "none" — медиаг дараа нь (дүрэм шилдгийг сонгосны дараа) */
  media?: MediaOpt; mediaFor?: "all" | "none";
  /** workspace ("main" = эзэн) */
  ws?: string;
  /** бүтээгдэхүүний зургийг постонд хавсаргах (анхдагч: тийм) */
  useProductImage?: boolean;
  /** «Өөр хувилбар» — шинэ хувилбарыг энэ бүлэгт нэмнэ */
  group?: string;
};
export type MediaOpt = { model?: string; ratio?: string; res?: string; dur?: number; fromImage?: boolean; personaId?: string };
async function resolveIdea(i: CreateInput): Promise<{ idea: string; base: string; origin: { src: string; sid: string }; productImage?: string }> {
  const ws = i.ws || MAIN_WS;
  if (i.source === "image") {
    if (!i.imageDataUrl) throw new Error("Зураг оруулна уу");
    const v = await imageIdea(i.imageDataUrl);
    return { idea: [i.text, v.idea].filter(Boolean).join(" — "), base: `ЗУРАГНААС: ${v.idea}\n${v.points.map((p) => `· ${p}`).join("\n")}${i.text ? `\nЭЗНИЙ ТАЙЛБАР: ${i.text}` : ""}`, origin: { src: "image", sid: "" } };
  }
  if (i.source === "top") {
    const v = await TuqorVec.findOne({ key: i.postKey, ws }).lean<{ key: string; text: string; score: number; likes: number; comments: number; views: number }>();
    if (!v) throw new Error("Пост олдсонгүй");
    return { idea: v.text.slice(0, 300), base: `САЙН АЖИЛЛАСАН ЭХ ПОСТ (оноо ${v.score}, ❤${v.likes} 💬${v.comments}${v.views ? ` 👁${v.views}` : ""}):\n${v.text}\n\nДААЛГАВАР: гол санааг хадгалж, hook-ийг хурцлах, шинэ өнцөг, шинэлэг хэллэгээр САЙЖРУУЛСАН хувилбарууд. Эх постыг үг үгээр давтахгүй.${i.text ? `\nЭЗНИЙ ЗААВАР: ${i.text}` : ""}`, origin: { src: "top", sid: v.key } };
  }
  if (i.source === "note") {
    const n = await AgentNote.findOne({ _id: i.noteId, ws }).lean();
    if (!n) throw new Error("Тэмдэглэл олдсонгүй");
    return { idea: `${n.title} ${n.body}`.slice(0, 300), base: `ЭЗНИЙ ТЭМДЭГЛЭЛ:\n${n.title}\n${n.body}`, origin: { src: "note", sid: String(n._id) } };
  }
  if (i.source === "product") {
    const p = await AgentProduct.findOne({ _id: i.productId, ws }).lean();
    if (!p) throw new Error("Бүтээгдэхүүн олдсонгүй");
    return { idea: `${p.name} ${p.pitch}`.slice(0, 300), base: `БҮТЭЭГДЭХҮҮН: ${p.name}\n${p.pitch}${p.price ? `\nҮнэ: ${p.price}` : ""}${p.link ? `\nХолбоос: ${p.link}` : ""}${p.cta ? `\nCTA: ${p.cta}` : ""}${p.imageUrl ? "\n(Постонд бүтээгдэхүүний бодит зураг хавсарна — зургийг тайлбарлахгүй, бүтээгдэхүүний ашиг тусыг хэл.)" : ""}${i.text ? `\nЭЗНИЙ ЗААВАР: ${i.text}` : ""}`, origin: { src: "product", sid: String(p._id) }, productImage: p.imageUrl || "" };
  }
  const t = (i.text || "").trim();
  if (!t) throw new Error("Санаагаа бичнэ үү");
  return { idea: t, base: `ЭЗНИЙ САНАА:\n${t}`, origin: { src: "idea", sid: "" } };
}

/* Агент эзний нэрээр ШУУД нийтэлдэг тул «Бодит явдал» өнцөг хүн/нас/тоо зохиож болохгүй
   (threadsVoice-ийн brief хүн шалгадаг /admin/threads/ai-д зориулагдсан). */
const STORY_SAFE = "Эзний санаа, тэмдэглэлд БАЙГАА бодит тохиолдлоор л түүх бич (хүн, нас, тоо, хугацааг яг тэр хэвээр). Тийм тохиолдол алга бол хүн, уулзалт, тоо ЗОХИОХГҮЙ — «Би олон хүнд харсан нэг зүйл…» гэх мэт эзний ажиглалт болгож бич. Төгсгөлд ганц мөр сургамж.";
type Draft = { angle: string; text: string; spec?: IgSpec; visual?: string };

/* AI зураг/видео загварт өгөх АНГЛИ промптын дүрэм (арт директор). Загварууд кирилл бичиг
   эвддэг тул зурган дээр бичиг, лого, уншигдах дэлгэц ОГТ байхгүй. */
type Brand = { name: string; about: string; color: string } | null;
const ART = (kind: "image" | "video", dur = 5, ratio = "9:16", brand: Brand = null) => `ART DIRECTION (write in ENGLISH, 60–110 words):
${brand ? `- Brand: ${brand.name} — ${brand.about.slice(0, 220)}. Look: bright, clean, honest modern commercial photography that fits THIS business${brand.color ? `; subtle accent color ${brand.color}` : ""}; soft natural light; premium, not cheesy.
- People (if any): Mongolian people in authentic everyday settings that match the business and its customers; natural, real skin texture.` : `- Brand: Antaqor — Mongolian AI-creator education. Look: bright, clean, modern tech-editorial; near-white surfaces (#F8F9FD), electric violet #2E29FF accent light or objects; soft natural light; premium, minimal, not cheesy.
- People (if any): young Mongolian / East Asian creators, natural, candid, real skin texture; laptops, phones, studio desk, Ulaanbaatar city when it fits.`}
- One concrete subject + setting + composition + lens/camera + light + mood that SHOWS the post's idea as a metaphor or real scene.
- ABSOLUTELY NO text, letters, numbers, captions, logos, watermarks or readable UI on screen.
${kind === "video" ? `- Video: ONE continuous ${dur}s shot, no cuts; describe the action over time and the camera move (slow push-in, orbit, handheld follow…); ${ratio === "9:16" ? "vertical 9:16 framing" : `${ratio} framing`}; natural ambient sound.` : `- Still photo, ${ratio} framing, sharp focus, magazine quality.`}`;

/** Постын текстээс AI зураг/видеоны промпт (англи) */
async function brandOf(ws: string): Promise<Brand> {
  if (ws === MAIN_WS) return null;
  const b = await getBusiness(ws);
  return b ? { name: b.name, about: b.about, color: b.brandColor } : null;
}
export async function visualPrompt(text: string, kind: "image" | "video", o: { dur?: number; ratio?: string; extra?: string; ws?: string } = {}): Promise<string> {
  const r = await llm("You are a senior art director writing prompts for AI image/video models. Output only JSON.", `${ART(kind, o.dur, o.ratio, await brandOf(o.ws || MAIN_WS))}\n\nPOST (Mongolian):\n${text.slice(0, 1500)}${o.extra ? `\n\nOWNER NOTE: ${o.extra}` : ""}\n\nJSON: {"prompt":"..."}`, 700, 0.8);
  const p = String(json<{ prompt?: string }>(r.text, {}).prompt || "").trim();
  if (p.length < 20) throw new Error("Медиа промпт гарсангүй");
  return p.slice(0, 1200);
}
async function generateDrafts(i: CreateInput, idea: { idea: string; base: string }, n: number): Promise<{ drafts: Draft[]; model: string; audience: string; cfg: Awaited<ReturnType<typeof getConfig>> }> {
  const ctx = await contextBlock({ ws: i.ws || MAIN_WS, idea: idea.idea, audienceId: i.audienceId, productId: i.productId || (i.source === "product" ? i.productId : undefined), withProducts: i.source !== "top" });
  const angles = ANGLES.map((a) => `${a.label}: ${a.key === "story" ? STORY_SAFE : a.brief}`).join("\n");
  const media = i.format === "image" || i.format === "video";
  const user = media
    ? `${ctx.context}\n\n${idea.base}\n\n${n} өөр БЭЛЭН пост бүтээ — тус бүр ${i.format === "video" ? "AI ВИДЕО" : "AI ЗУРАГ"}-тай нийтлэгдэнэ. Хувилбар бүр ӨӨР өнцөг, өөр hook, өөр дүрслэл:
${angles}
Caption: ${i.format === "video" ? "1–5 мөр, видеог үзүүлэх hook-оор эхэл" : "1–6 мөр"}, сүүлийн мөр CTA, Threads-ийн 500 хязгаар.
visual: доорх дүрмээр тухайн постыг дүрслэх АНГЛИ промпт.
${ART(i.format as "image" | "video", i.media?.dur || 5, i.media?.ratio || "9:16", ctx.biz ? { name: ctx.biz.name, about: ctx.biz.about, color: ctx.biz.brandColor } : null)}
Зөвхөн JSON массив: [{"angle":"өнцгийн нэр","text":"постын бүтэн текст","visual":"english prompt"}]`
    : i.format === "infographic"
    ? `${ctx.context}\n\n${idea.base}\n\n${n} өөр EDUCATIONAL INFOGRAPHIC бүтээ. Тус бүр өөр загвар/өнцөгтэй. Infographic дээрх бичиг МАШ богино, тод (гарчиг ≤ 38 тэмдэгт, мөр бүр ≤ 60). Emoji хэрэглэхгүй.
Загварууд: steps (1→N алхам), list (N зөвлөгөө/хэрэгсэл), compare (left/right баганын нэр; items бүр НЭГ мөр: label = мөрийн нэр, title = ЗҮҮН баганын утга, text = БАРУУН баганын утга — «vs» бүү бич), stat (тоо + тайлбар — зөвхөн эзний өгсөн эсвэл нийтэд мэдэгдэх баримт).
Мөн пост бүрт caption (Threads/FB/IG тайлбар, 2-6 мөр, сүүлийн мөр CTA).
Зөвхөн JSON массив: [{"angle":"загвар","template":"steps|list|compare|stat","title":"","subtitle":"","left":"(compare-д) зүүн баганын нэр","right":"баруун","items":[{"label":"(compare-д)","title":"","text":""}],"cta":"зурган доорх нэг мөр","caption":"постын текст"}]`
    : `${ctx.context}\n\n${idea.base}\n\n${n} өөр БЭЛЭН пост бич (санал биш — шууд нийтлэх). Хувилбар бүр ӨӨР өнцөг, өөр hook-той, өөр урттай:
${angles}
Урт: ${n === 1 ? "сэдэвт хамгийн тохирох урт (1–8 мөр)" : "богино цочрол 1–3 мөр (30–180 тэмдэгт) — дор хаяж 1 хувилбар; задлал 4–8 мөр (150–420 тэмдэгт) — дор хаяж 1"}. Threads-ийн 500 хязгаарыг бүү хэтрүүл.
Зөвхөн JSON массив: [{"angle":"өнцгийн нэр","text":"постын бүтэн текст"}]`;
  const r = await llm(ctx.system, user, 4500, 0.95);
  const arr = json<Record<string, unknown>[]>(r.text, []);
  const drafts: Draft[] = arr.map((x) => {
    const text = String(x.caption || x.text || "").trim();
    if (media) return { angle: String(x.angle || ""), text, visual: String(x.visual || "").trim().slice(0, 1200) };
    if (i.format !== "infographic") return { angle: String(x.angle || ""), text };
    const items = (Array.isArray(x.items) ? x.items : []).map((it: { title?: unknown; text?: unknown; label?: unknown }) => ({ title: String(it?.title || ""), text: String(it?.text || ""), label: String(it?.label || "") })).filter((it: { title: string }) => it.title);
    const tpl = ["steps", "list", "compare", "stat"].includes(String(x.template)) ? (String(x.template) as IgSpec["template"]) : "steps";
    return { angle: String(x.angle || tpl), text, spec: { template: tpl, title: String(x.title || ""), subtitle: String(x.subtitle || ""), left: String(x.left || ""), right: String(x.right || ""), items, cta: String(x.cta || "") } };
  }).filter((d) => d.text.length >= 10 && (!d.spec || (d.spec.title && d.spec.items.length >= 2)));
  return { drafts: drafts.slice(0, n), model: r.model, audience: ctx.audience, cfg: ctx.cfg };
}

export async function createVariants(i: CreateInput): Promise<{ group: string; idea: string; posts: PostL[]; visuals: Record<string, string> }> {
  await dbConnect();
  const ws = i.ws || MAIN_WS;
  i = { ...i, ws };
  const media = i.format === "image" || i.format === "video";
  const n = Math.max(1, Math.min(6, i.count || 1));
  await useGen(ws, n);
  try { await syncVectors(true, ws); } catch { /* */ }
  try { await embedNotes(ws); } catch { /* */ }
  const idea = await resolveIdea(i);
  /* бүтээгдэхүүний бодит зураг: пост → зурагтай, AI зураг → оронд нь бодит зураг, AI видео → зургийг хөдөлгөнө */
  const prodImg = i.source === "product" && i.useProductImage !== false && i.format !== "infographic" ? idea.productImage || "" : "";
  if (media && !hfReady() && !(prodImg && i.format === "image")) throw new Error("Higgsfield тохируулаагүй");
  const { drafts, model, audience, cfg } = await generateDrafts(i, idea, n);
  if (!drafts.length) throw new Error("AI хувилбар гаргасангүй — дахин оролдоно уу");
  const pol = await polish(drafts.map((d) => d.text), { spell: cfg.spellFix !== false, generic: cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT });
  const texts = pol.map((p) => p.text);
  const preds = await predict(texts, [], ws);
  const group = i.group && (await TuqorPost.exists({ variantGroup: i.group, ws })) ? i.group : randomUUID();
  const visualFmt = i.format === "infographic" || media || !!prodImg;
  const platforms = (i.platforms?.length ? i.platforms : visualFmt ? ["instagram", "facebook", "threads"] : cfg.channels.length ? cfg.channels : ["threads", "facebook"]).filter((p) => ["threads", "facebook", "instagram"].includes(p));
  const out: PostL[] = [];
  const visuals: Record<string, string> = {};
  for (let k = 0; k < drafts.length; k++) {
    const d = drafts[k];
    let imageUrl = prodImg;
    if (d.spec) { try { imageUrl = (await renderInfographic(d.spec, i.theme || "light")).url; } catch (e) { console.error("[agent] infographic", e); } }
    const reasons = [...guard(texts[k], idea.idea + " " + (i.text || ""), platforms), ...(preds[k].novelty < 0.1 ? [`Өмнөх посттой хэт төстэй (${Math.round((1 - preds[k].novelty) * 100)}%)`] : [])];
    const doc = await TuqorPost.create({
      ws, day: "", at: new Date(Date.now() + 3600e3), text: texts[k], format: (Array.from(texts[k]).length <= 180 ? "spark" : i.source === "product" ? "offer" : "value") as TuqorFormat,
      source: "idea", idea: idea.idea.slice(0, 1500), platforms: d.spec && !imageUrl ? platforms.filter((p) => p !== "instagram") : platforms,
      status: "draft", holdReason: reasons.join(" · "), pred: preds[k], aiModel: model,
      kind: d.spec ? "infographic" : media ? i.format : prodImg ? "image" : "text", imageUrl, infographic: d.spec ? { ...d.spec, theme: i.theme || "light" } : null,
      audience, variantGroup: group, angle: d.angle, fixes: pol[k].fixes, generic: pol[k].generic, origin: idea.origin,
    });
    out.push(doc.toObject() as unknown as PostL);
    if (media) visuals[String(doc._id)] = d.visual || "";
  }
  /* Хувилбар бүрт медиа (Higgsfield) — дүрэм бол шилдгийг сонгосны дараа ганцыг л */
  if (media && i.mediaFor !== "none" && !(prodImg && i.format === "image")) {
    for (const p of out) {
      try { await startMedia(String(p._id), visuals[String(p._id)] || (await visualPrompt(p.text, i.format as "image" | "video", { dur: i.media?.dur, ratio: i.media?.ratio, ws })), i.format as "image" | "video", { ...(i.media || {}), fromImage: !!prodImg || i.media?.fromImage }); }
      catch (e) { await TuqorPost.updateOne({ _id: p._id }, { $set: { mediaState: "failed", holdReason: [p.holdReason, (e as Error).message].filter(Boolean).join(" · ") } }); }
    }
    const fresh = await TuqorPost.find({ _id: { $in: out.map((p) => p._id) } }).lean<PostL[]>();
    return { group, idea: idea.idea, posts: out.map((p) => fresh.find((f) => String(f._id) === String(p._id)) || p), visuals };
  }
  return { group, idea: idea.idea, posts: out, visuals };
}

/* ─── Медиа (Higgsfield): эхлүүлэх → cron/UI шалгана → хадгалж пост руу холбоно ─── */
const MEDIA_TTL = 3 * 3600e3;
export async function spentToday(ws: string = MAIN_WS): Promise<number> {
  const agg = await AgentMedia.aggregate([{ $match: { ws, status: { $ne: "failed" }, createdAt: { $gte: ubDayStart(new Date()) } } }, { $group: { _id: null, usd: { $sum: "$usd" } } }]);
  return Math.round((agg[0]?.usd || 0) * 1000) / 1000;
}
async function budgetCheck(usd: number, ws: string) {
  /* 2026-10-26: эзэн ("main") — өдрийн $ хязгааргүй (эзний хүсэлт). Гишүүн —
     кредитээр төлдөг тул $ хязгаар биш, кредитийн үлдэгдэл нь хязгаар (studioCredits). */
  /* 2026-11-02: кредит хасахаа больсон тул гишүүн ч өдрийн $ хязгаартай (default $5/өдөр/workspace). */
  if (ws === MAIN_WS) return;
  const cfg = await getConfig(ws);
  const cap = cfg.media?.dailyUsd ?? 5, spent = await spentToday(ws);
  if (spent + usd > cap + 1e-9) throw new Error(`Өнөөдрийн медиа хязгаар $${cap} — зарцуулсан $${spent.toFixed(2)}, энэ ажил ≈ $${usd.toFixed(2)}. Тохиргооноос нэмнэ үү.`);
}
/** Загвар/харьцаа/чанар/уртыг тухайн загварын зөвшөөрөгдсөн утга руу шахна */
function normalize(kind: "image" | "video" | "motion" | "edit", o: MediaOpt & { model?: string }, cfg: Awaited<ReturnType<typeof getConfig>>) {
  const fallback = kind === "image" ? cfg.media.imageModel : kind === "video" ? cfg.media.videoModel : kind === "edit" ? "flare" : "genjutsuLite";
  const m = hfModel(o.model || fallback) || hfModel(fallback)!;
  if (m.kind !== kind) throw new Error(`${m.label} — ${kind === "image" ? "зургийн" : kind === "video" ? "видеоны" : kind === "edit" ? "засварын" : "Genjutsu"} загвар биш`);
  const ratio = m.ratios.includes(o.ratio || "") ? o.ratio! : m.ratios.includes(cfg.media.ratio) ? cfg.media.ratio : m.ratios[0] || "";
  const res = m.res.includes(o.res || "") ? o.res! : kind === "video" && m.res.includes(cfg.media.videoRes) ? cfg.media.videoRes : m.res[0];
  const want = o.dur || cfg.media.videoDur || 5;
  const dur = kind === "video" ? m.durations.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), m.durations[0]) : kind === "motion" ? Math.max(1, Math.min(15, Math.ceil(want))) : 0;
  return { m, ratio, res, dur };
}
export async function startMedia(postId: string, prompt: string, kind: "image" | "video", o: MediaOpt) {
  /* (prompt-ийг дүртэй үед дахин бичнэ) */
  const p = await TuqorPost.findById(postId).lean<PostL>();
  if (!p) throw new Error("Пост олдсонгүй");
  const ws = p.ws || MAIN_WS;
  const cfg = await getConfig(ws);
  /* «Миний дүр»-тэй AI зураг: ref sheet-ийг 1-р зураг болгож засварын загвараар (Flare) зурна */
  const sheet = kind === "image" && o.personaId ? await personaSheet(ws, o.personaId) : "";
  const { m, ratio, res, dur } = normalize(sheet ? "edit" : kind, sheet ? { ratio: o.ratio, model: "flare" } : o, cfg);
  const usd = hfCost(m.id, { res, dur });
  await budgetCheck(usd, ws);
  const imageUrl = kind === "video" && o.fromImage && p.imageUrl ? siteUrl(p.imageUrl) : undefined;
  if (sheet) prompt = `Photo of the exact person from the reference sheet (identical face, hairstyle, skin tone and body) in this scene: ${prompt}`;
  const { requestId, endpoint } = await hfSubmit(m.id, { prompt, ratio, res, dur, imageUrl, imageUrls: sheet ? [siteUrl(sheet)] : undefined });
  const doc = await AgentMedia.create({ ws, kind, modelId: m.id, prompt, idea: p.text.slice(0, 600), ratio, res, dur, status: "running", requestId, endpoint, usd, postId, refs: imageUrl ? [imageUrl] : [] });
  await TuqorPost.updateOne({ _id: postId }, { $set: { mediaId: String(doc._id), mediaState: "rendering", kind } });
  return { id: String(doc._id), usd };
}
/** Медиа студи — постгүй шууд үүсгэх (зураг / видео / Genjutsu) */
export async function mediaCreate(b: { ws?: string; model: string; prompt: string; enhance?: boolean; ratio?: string; res?: string; dur?: number; imageUrl?: string; videoUrl?: string; imageUrls?: string[]; refDur?: number; productId?: string; preset?: string; then?: string; idea?: string; personaId?: string }) {
  await dbConnect();
  const ws = b.ws || MAIN_WS;
  await useGen(ws);
  const cfg = await getConfig(ws);
  /* Медиа студи: «Миний дүр»-тэй AI зураг → Flare засвар, sheet нь 1-р лавлах зураг */
  if (b.personaId && hfModel(b.model)?.kind === "image") {
    const sheet = await personaSheet(ws, b.personaId);
    let pr = (b.prompt || "").trim();
    if (b.enhance !== false && pr.length > 2) pr = await visualPrompt(pr, "image", { ratio: b.ratio, ws });
    b = { ...b, model: "flare", enhance: false, imageUrls: [sheet, ...(b.imageUrls || [])], prompt: `Photo of the exact person from the reference sheet (image 1 — identical face, hairstyle, skin tone and body) in this scene: ${pr}`, idea: b.idea || b.prompt };
  }
  const def = hfModel(b.model);
  if (!def) throw new Error("Загвар сонгоно уу");
  const kind = def.kind;
  let prompt = (b.prompt || "").trim().slice(0, 2000);
  if (kind !== "motion" && prompt.length < 3) throw new Error("Юу бүтээхээ бичнэ үү");
  if ((kind === "image" || kind === "video") && b.enhance !== false) prompt = await visualPrompt(prompt, kind, { dur: b.dur, ratio: b.ratio, ws });
  if (b.productId && !(await AgentProduct.exists({ _id: b.productId, ws }))) throw new Error("Бүтээгдэхүүн олдсонгүй");
  const { m, ratio, res, dur } = normalize(kind, { ...b, dur: kind === "motion" ? b.refDur || 10 : b.dur }, cfg);
  const usd = hfCost(m.id, { res, dur });
  await budgetCheck(usd, ws);
  const ch = await chargeStudio(ws, usd, 1, `${m.id}:${b.preset || kind}`);
  let sub: { requestId: string; endpoint: string };
  try {
    sub = await hfSubmit(m.id, { prompt, ratio, res, dur, imageUrl: kind === "video" && b.imageUrl ? siteUrl(b.imageUrl) : undefined, videoUrl: b.videoUrl ? siteUrl(b.videoUrl) : undefined, imageUrls: (b.imageUrls || []).slice(0, 10).map(siteUrl) });
  } catch (e) { await refundCharge(ch, 1, m.id); throw e; }
  const { requestId, endpoint } = sub;
  const doc = await AgentMedia.create({ ws, kind: kind === "image" || kind === "edit" ? "image" : "video", modelId: m.id, prompt, idea: (b.idea || b.prompt || "").slice(0, 600), ratio, res, dur, status: "running", requestId, endpoint, usd, postId: "", refs: [b.imageUrl, b.videoUrl, ...(b.imageUrls || [])].filter(Boolean) as string[], productId: b.productId || "", preset: b.preset || "", then: b.then || "", personaId: b.personaId || "", credits: ch?.per || 0, payer: ch?.payer || "" });
  return { id: String(doc._id), usd, credits: ch?.per || 0 };
}

/* ─── «AI зураг» хэсэг (2026-10-24) — Higgsfield Image-ээс санаа авсан нэг мөрийн бүтээгч ───
   1–4 зураг нэг дор (batch). Nano Banana → Google шууд (арын ажил), бусад → Higgsfield.
   Higgsfield данс зэрэг 2 ажил авдаг — завгүй гэвэл job-ийг хадгалж pollMedia дараа илгээнэ.
   @нэр эсвэл сонгосон AI ихрийн sheet нь эхний лавлах зургууд болно. */
const HF_BUSY = /concurren|too many|429|rate.?limit|limit reached|busy|slots?/i;
async function imagePrompt(text: string, legend: string): Promise<string> {
  const r = await llm("You turn a user's idea (often written in Mongolian) into ONE clear English prompt for an AI image model. Output only JSON.",
    `IDEA:\n${text.slice(0, 1500)}\n${legend ? `\nREFERENCE IMAGES:\n${legend}\n` : ""}
Rules: keep exactly the subject, people, objects, colours and setting the user asked for — never swap or add a different subject. Words the user wants written ON the image (in quotes, or clearly a headline/menu/price) stay character-for-character, including Mongolian Cyrillic. Only add what is missing: composition, camera and lens, lighting, mood, materials. 40–110 words. No brand or logo the user did not mention.
JSON: {"prompt":"..."}`, 600, 0.6);
  const p = String(json<{ prompt?: string }>(r.text, {}).prompt || "").trim();
  return p.length >= 15 ? p.slice(0, 1500) : text;
}
async function inlineRef(u: string): Promise<{ mimeType: string; data: string }> {
  const raw = u.startsWith("/uploads/") ? await readFile(`${process.cwd()}/public${u.split("?")[0]}`) : Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(30_000) })).arrayBuffer());
  const buf = await sharp(raw).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toBuffer();
  return { mimeType: "image/jpeg", data: buf.toString("base64") };
}
/** Google Nano Banana — API хүсэлтийг хүлээлгэхгүй, арын ажлаар (pm2 процесс) */
async function runGoogle(id: string, o: { model: string; prompt: string; ratio: string; res: string; refs: string[] }) {
  try {
    const refImages = await Promise.all(o.refs.map(inlineRef));
    const r = await generateNanoBanana({ modelId: o.model === "nanoPro" ? "nanoPro" : "nano2", prompt: o.prompt, refImages, aspectRatio: o.ratio === "auto" ? undefined : o.ratio, size: o.res === "2k" ? "2K" : "1K" });
    const saved = await saveBuffer(r.buf, "image");
    const u = await AgentMedia.updateOne({ _id: id, status: "running" }, { $set: { status: "done", url: saved.url, pollUntil: null, ...(r.usd > 0 ? { usd: Math.round(r.usd * 10000) / 10000 } : {}) } });
    if (!u.matchedCount) await unlink(`${process.cwd()}/public${saved.url}`).catch(() => {});
    await googleHealth(true);
  } catch (e) {
    const error = String((e as Error).message || "Nano Banana алдаа").slice(0, 200);
    if (BILLING.test(error)) await googleHealth(false, error);
    await AgentMedia.updateOne({ _id: id, status: "running" }, { $set: { status: "failed", error, pollUntil: null } });
  }
}
/** Google (Nano Banana) төлбөрийн алдаагаар унавал 12 цаг «түр зогссон» — Авто өөр загвар сонгоно.
    Төлөв нь медиа мөрөөс биш тусдаа бичлэгт (хэрэглэгч алдаатай зургаа устгавал төлөв алдагдахгүй). */
const BILLING = /prepay|billing|depleted|RESOURCE_EXHAUSTED|402|quota/i;
const health = () => mongoose.connection.collection<{ _id: string; ok: boolean; error: string; at: Date }>("agent_health");
async function googleHealth(ok: boolean, error = "") {
  await health().updateOne({ _id: "google" }, { $set: { ok, error: error.slice(0, 200), at: new Date() } }, { upsert: true }).catch(() => {});
}
export async function googleDown(): Promise<boolean> {
  if (!geminiImageKey()) return true;
  const h = await health().findOne({ _id: "google" }).catch(() => null);
  return !!h && h.ok === false && Date.now() - +new Date(h.at) < 12 * 3600e3;
}
const reEsc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function imageGen(b: { ws?: string; model: string; prompt: string; enhance?: boolean; ratio?: string; res?: string; q?: string; count?: number; refs?: string[]; personaIds?: string[] }) {
  await dbConnect();
  const ws = b.ws || MAIN_WS;
  const idea = (b.prompt || "").trim().slice(0, 2000);
  if (idea.length < 3) throw new Error("Юу зурахаа бичнэ үү");
  const count = Math.max(1, Math.min(4, Math.round(Number(b.count) || 1)));
  const ready = await AgentPersona.find({ ws, status: "ready", sheetUrl: { $ne: "" } }).select("name sheetUrl").lean<{ _id: Types.ObjectId; name: string; sheetUrl: string }[]>();
  const want = new Set((b.personaIds || []).map(String));
  const pers = ready.filter((p) => want.has(String(p._id)) || (!!p.name && new RegExp(`@${reEsc(p.name)}(?![\\p{L}\\d_])`, "iu").test(idea))).slice(0, 3);
  const own = (b.refs || []).filter((u) => typeof u === "string" && /^(\/uploads\/|https:\/\/)/.test(u)).slice(0, 10);
  const refs = [...pers.map((p) => p.sheetUrl), ...own].slice(0, 10);
  const google = !(await googleDown());
  const chosen = imgModel(b.model === AUTO ? "" : b.model);
  if (chosen?.provider === "google" && !google) throw new Error(`${chosen.label} түр ажиллахгүй байна (Google талын төлбөр) — «Автомат» эсвэл GPT Image сонгоно уу`);
  let m = chosen || imgModel(autoPick(idea, refs.length, google).id)!;
  if (refs.length && !m.refs) m = imgModel(google ? "nano21" : "gpt25")!;
  if (m.provider === "hf" && !hfReady()) throw new Error("Higgsfield тохируулаагүй");
  const { ratio, res, q } = imgNorm(m, b);
  const use = refs.slice(0, m.refs);
  const legend = use.map((_, i) => (i < pers.length ? `Image ${i + 1} = reference sheet of ${pers[i].name}: the very same person — identical face, hairstyle, skin tone and body.` : `Image ${i + 1} = the user's reference photo — keep its subject/product exactly as it is.`)).join("\n");
  const clean = idea.replace(/@([\p{L}\d_]+)/gu, "$1");
  const body = b.enhance !== false ? await imagePrompt(clean, legend).catch(() => clean) : clean;
  const prompt = (legend ? `${legend}\n\n${body}` : body).slice(0, 2000);
  const unit = imgCost(m.id, res, q);
  await budgetCheck(unit * count, ws);
  await useGen(ws, count);
  const ch = await chargeStudio(ws, unit, count, `image:${m.id}`);
  const batch = randomUUID().slice(0, 8);
  const hfOpts: HfOpts = { prompt, ratio, res, q, dur: 0, imageUrls: use.map(siteUrl) };
  const docs = await AgentMedia.insertMany(Array.from({ length: count }, () => ({
    ws, kind: "image", modelId: m.id, prompt, idea, ratio, res, q, dur: 0, status: "running", requestId: "", usd: unit, postId: "", refs: use, batch, preset: "image",
    endpoint: m.provider === "google" ? `google:${m.id}` : hfModel(m.id)?.ep || "", personaId: pers[0] ? String(pers[0]._id) : "",
    job: m.provider === "hf" ? { model: m.id, opts: hfOpts } : null,
    credits: ch?.per || 0, payer: ch?.payer || "",
  }))).catch(async (e) => { await refundCharge(ch, count, `image:${m.id}`); throw e; });
  const ids = docs.map((d) => String(d._id));
  if (m.provider === "google") {
    for (const id of ids) void runGoogle(id, { model: m.id, prompt, ratio, res, refs: use });
  } else {
    for (const [i, id] of ids.entries()) {
      try {
        const { requestId, endpoint } = await hfSubmit(m.id, hfOpts);
        await AgentMedia.updateOne({ _id: id }, { $set: { requestId, endpoint, job: null } });
      } catch (e) {
        const msg = (e as Error).message;
        if (HF_BUSY.test(msg)) break;                  /* үлдсэнийг pollMedia илгээнэ */
        await AgentMedia.updateMany({ _id: { $in: ids.slice(i) } }, { $set: { status: "failed", error: msg.slice(0, 200), job: null } });
        if (i === 0) { await refundFailedStudio().catch(() => 0); throw e; }
        break;
      }
    }
  }
  return { batch, ids, model: m.id, label: m.label, usd: Math.round(unit * count * 1000) / 1000, credits: ch ? ch.per * count : 0, auto: b.model === AUTO };
}

/* ─── Бүтээгдэхүүний студи (2026-10-24, v2) ──────────────────────────────
   1) analyzeImage — vision агент зургийг шинжилнэ: ангилал + эд зүйлс (Монгол нэр, англи нарийн
      тодорхойлолт, хэсэг). Хэрэглэгч аль хэсгийг гэдгээ ТОВШИЖ сонгоно (бичих шаардлагагүй).
   2) studioRun — ангиллын загвар + сонгосон хэсгийн тодорхойлолт (+ «Миний дүр» sheet) → Flare засвар.
   3) Бэлэн болмогц gallery-д орж, `then` байвал хөдөлгөөн (Wan 3.0 image-to-video) автоматаар эхэлнэ. */
const CATS: Category[] = ["clothing", "food", "beauty", "tech", "home", "jewelry", "other"];
const CAT_SET = new Set<string>(CATS);
export async function analyzeImage(b: { ws: string; imageUrl: string; productId?: string; force?: boolean }) {
  await dbConnect();
  if (!b.imageUrl) throw new Error("Зураг алга");
  if (b.productId && !b.force) {
    const cached = (await AgentProduct.findOne({ _id: b.productId, ws: b.ws }).select("analysis").lean<{ analysis: { src: string } | null }>())?.analysis;
    if (cached?.src === b.imageUrl) return cached;
  }
  await useGen(b.ws);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Vision тохируулаагүй");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: process.env.AGENT_VISION_MODEL || WRITER(), max_completion_tokens: 1200, reasoning_effort: "none",
      messages: [{ role: "user", content: [
        { type: "text", text: `Analyze this product/photo for an e-commerce image studio. Return ONLY JSON:
{"category":"clothing|food|beauty|tech|home|jewelry|other","summary_mn":"нэг өгүүлбэр Монголоор","hasPerson":true,
 "items":[{"mn":"богино Монгол нэр (2-4 үг)","en":"precise English description for an image editor: color, material, pattern, distinctive details (buttons, trim, logo, sole, garnish)","part":"top|outerwear|bottom|dress|shoes|bag|hat|accessory|jewelry|dish|drink|product"}]}
Rules: list EVERY distinct sellable item visible (max 8), most prominent first. For food list the dish(es) and drinks. Do not guess brands. Be exact about colors.
Context: this is a Mongolian business. Name Mongolian dishes correctly in "mn" (хуушуур = flat half-moon fried meat pastry, бууз = steamed dumplings, банш = small boiled dumplings, цуйван = fried noodles with meat, хорхог, борцог, гурилтай шөл, сүүтэй цай…) and use natural Mongolian names for clothing (цамц, өмд, пүүз, куртка, малгай…).` },
        { type: "image_url", image_url: { url: siteUrl(b.imageUrl) } },
      ] }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Зураг шинжилж чадсангүй: ${d?.error?.message || r.status}`);
  const j = json<{ category?: string; summary_mn?: string; hasPerson?: boolean; items?: { mn?: string; en?: string; part?: string }[] }>(String(d?.choices?.[0]?.message?.content || ""), {});
  const items: DetectedItem[] = (j.items || []).map((x) => ({ mn: String(x.mn || "").slice(0, 40), en: String(x.en || "").slice(0, 300), part: String(x.part || "product") })).filter((x) => x.mn && x.en).slice(0, 8);
  const analysis = { src: b.imageUrl, category: CAT_SET.has(String(j.category)) ? String(j.category) : "other", summary: String(j.summary_mn || "").slice(0, 300), items, hasPerson: !!j.hasPerson, at: new Date() };
  if (b.productId) await AgentProduct.updateOne({ _id: b.productId, ws: b.ws }, { $set: { analysis, ...(analysis.category ? { category: analysis.category } : {}) } });
  return analysis;
}
async function personaSheet(ws: string, id: string): Promise<string> {
  const p = await AgentPersona.findOne({ _id: id, ws }).lean<{ sheetUrl: string; status: string; photos: string[] }>();
  if (!p) throw new Error("Дүр олдсонгүй");
  if (p.status !== "ready" || !p.sheetUrl) throw new Error("Дүрийн ref sheet хараахан бэлэн болоогүй байна");
  return p.sheetUrl;
}
export async function studioRun(b: { ws: string; preset: string; imageUrl: string; productId?: string; hq?: boolean; then?: string; note?: string; items?: string[]; category?: string; personaId?: string }) {
  const p = IMAGE_PRESETS.find((x) => x.id === b.preset);
  if (!p) throw new Error("Загвар олдсонгүй");
  if (!b.imageUrl) throw new Error("Эх зураг оруулна уу");
  const cat = (CAT_SET.has(b.category || "") ? b.category : "other") as Category;
  if (p.persona === "need" && !b.personaId) throw new Error("Энэ загварт «Миний дүр» хэрэгтэй — эхлээд дүрээ үүсгээд сонгоно уу");
  const sheet = b.personaId && p.persona ? await personaSheet(b.ws, b.personaId) : "";
  const items = (b.items || []).map((x) => x.trim()).filter(Boolean).slice(0, 4);
  const item = items.length ? items.map((x) => `the ${x.replace(/^(the|a|an)\s+/i, "")}`).join(" and ") : defaultItem(cat);
  const prompt = `${p.prompt({ item, whole: !items.length, cat, person: !!sheet })}${b.note?.trim() ? ` Additional direction: ${b.note.trim().slice(0, 300)}` : ""}`;
  return mediaCreate({ ws: b.ws, model: p.model, prompt, enhance: false, ratio: p.ratio, res: b.hq ? (p.model === "flare" ? "high" : "2k") : p.model === "flare" ? p.quality : "1k", imageUrls: sheet ? [sheet, b.imageUrl] : [b.imageUrl], productId: b.productId, preset: p.id, then: b.then, idea: p.label, personaId: sheet ? b.personaId : "" });
}
export async function motionRun(b: { ws: string; preset: string; imageUrl: string; productId?: string; dur?: number; note?: string }) {
  const p = MOTION_PRESETS.find((x) => x.id === b.preset);
  if (!p) throw new Error("Хөдөлгөөн олдсонгүй");
  if (!b.imageUrl) throw new Error("Хөдөлгөх зураг сонгоно уу");
  const cfg = await getConfig(b.ws);
  /* image-to-video чадвартай загвар (анхдагч Wan 3.0) */
  const model = hfModel(cfg.media.videoModel)?.epImage ? cfg.media.videoModel : "wan3";
  return mediaCreate({ ws: b.ws, model, prompt: `${p.prompt}${b.note?.trim() ? ` ${b.note.trim().slice(0, 300)}` : ""}`, enhance: false, imageUrl: b.imageUrl, dur: b.dur || 5, res: cfg.media.videoRes, productId: b.productId, preset: p.id, idea: p.label });
}
/** Нэг товч, ангиллаар: хувцас/бусад — салгах (→ 360°) + студи; хоол — амттай (→ уур) + салгах */
export async function studioPack(b: { ws: string; imageUrl: string; productId?: string; category?: string; items?: string[] }) {
  const cat = (CAT_SET.has(b.category || "") ? b.category : "other") as Category;
  const pk = packFor(cat);
  const base = { ws: b.ws, imageUrl: b.imageUrl, productId: b.productId, category: cat, items: b.items };
  const jobs = [await studioRun({ ...base, preset: pk.first, then: pk.then })];
  for (const id of pk.also) jobs.push(await studioRun({ ...base, preset: id }));
  return { jobs: jobs.length, usd: Math.round((jobs.reduce((x, y) => x + y.usd, 0) + 0.2) * 100) / 100 };
}
/* «Миний дүр» — биеийн 1–4 зураг → ref sheet (Flare). Зөвхөн өөрийн / зөвшөөрөлтэй зураг. */
export async function personaCreate(b: { ws: string; name: string; photos: string[] }) {
  await dbConnect();
  const photos = (b.photos || []).filter(Boolean).slice(0, 4);
  if (!photos.length) throw new Error("Биеийн зургаа оруулна уу (1–4)");
  if ((await AgentPersona.countDocuments({ ws: b.ws })) >= 6) throw new Error("Дүр 6-аас ихгүй байна — хуучнаа устгана уу");
  const first = !(await AgentPersona.exists({ ws: b.ws }));
  const per = await AgentPersona.create({ ws: b.ws, name: (b.name || "Миний дүр").trim().slice(0, 40), photos, status: "rendering", isDefault: first });
  try {
    const r = await mediaCreate({ ws: b.ws, model: "flare", prompt: PERSONA_SHEET, enhance: false, ratio: "3:2", res: "medium", imageUrls: photos, preset: "persona", idea: `Дүрийн sheet · ${per.name}`, personaId: String(per._id) });
    await AgentPersona.updateOne({ _id: per._id }, { $set: { mediaId: r.id } });
    return { id: String(per._id), usd: r.usd };
  } catch (e) { await AgentPersona.updateOne({ _id: per._id }, { $set: { status: "failed", error: (e as Error).message } }); throw e; }
}
export async function personaOp(ws: string, id: string, op: string, b: { name?: string }) {
  if (op === "delete") { await AgentPersona.deleteOne({ _id: id, ws }); return {}; }
  if (op === "default") { await AgentPersona.updateMany({ ws }, { $set: { isDefault: false } }); await AgentPersona.updateOne({ _id: id, ws }, { $set: { isDefault: true } }); return {}; }
  if (op === "rename") { await AgentPersona.updateOne({ _id: id, ws }, { $set: { name: String(b.name || "").trim().slice(0, 40) || "Миний дүр" } }); return {}; }
  if (op === "retry") {
    const p = await AgentPersona.findOne({ _id: id, ws }).lean<{ photos: string[]; name: string }>();
    if (!p) throw new Error("Дүр олдсонгүй");
    await AgentPersona.updateOne({ _id: id, ws }, { $set: { status: "rendering", error: "" } });
    const r = await mediaCreate({ ws, model: "flare", prompt: PERSONA_SHEET, enhance: false, ratio: "3:2", res: "medium", imageUrls: p.photos, preset: "persona", idea: `Дүрийн sheet · ${p.name}`, personaId: id });
    await AgentPersona.updateOne({ _id: id, ws }, { $set: { mediaId: r.id } });
    return { usd: r.usd };
  }
  throw new Error("Үйлдэл буруу");
}
/* ─── AI ихэр (2026-10-24) ──────────────────────────────────────────────
   Нүүр (1–2) / бие / гар / стилийн лавлах тусдаа → агент «нүүрний DNA»-г бичнэ (хэрэглэгч засна)
   → стиль, өнгө, илэрхийлэл, анхдагч хувцас → толгой / бие / скульптур sheet (Flare, ~15–25с).
   Бэлэн болмогц биеийн sheet нь бусад бүх ажилд (try-on, Медиа, пост, Genjutsu) лавлах болно. */
export async function twinAnalyze(b: { ws: string; faces: string[]; bodies: string[] }): Promise<TwinProfile> {
  const faces = (b.faces || []).filter(Boolean).slice(0, 2), bodies = (b.bodies || []).filter(Boolean).slice(0, 1);
  if (!faces.length) throw new Error("Нүүрний зураг оруулна уу");
  await useGen(b.ws);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Vision тохируулаагүй");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(90_000),
    body: JSON.stringify({
      model: process.env.AGENT_VISION_MODEL || WRITER(), max_completion_tokens: 1400, reasoning_effort: "none",
      messages: [{ role: "user", content: [
        { type: "text", text: `You are a senior character artist extracting the FACIAL DNA of ONE person for a digital-twin character sheet. The first image(s) are face photos${bodies.length ? ", the last is a full-body photo" : ""}. Return ONLY JSON (English values):
{"gender":"male|female","age":"e.g. early twenties","eyeColor":"precise iris color","hair":"color, length, texture, style, fringe","skin":"tone and distinctive marks (freckles, moles, redness) or none","build":"height impression and body build, or empty if no body photo","dna":"6-8 short lines, one per feature, each starting with the feature name: Skull & neck; Face width & cheekbones (say which is the widest point); Planes, cheeks, jaw & chin; Brow; Eyes (shape, lids, spacing); Nose; Mouth & lips; Ears. Concrete and measurable, no flattery, no beautifying."}` },
        ...[...faces, ...bodies].map((u) => ({ type: "image_url", image_url: { url: siteUrl(u) } })),
      ] }],
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Зураг шинжилж чадсангүй: ${d?.error?.message || r.status}`);
  const j = json<Partial<TwinProfile>>(String(d?.choices?.[0]?.message?.content || ""), {});
  const t = (v: unknown, n = 300) => String(v || "").slice(0, n);
  if (!j.dna) throw new Error("Нүүрний бүтцийг тодорхойлж чадсангүй — илүү тод, урдаас авсан зураг оруулна уу");
  return { gender: t(j.gender, 20), age: t(j.age, 40), eyeColor: t(j.eyeColor, 60), hair: t(j.hair, 200), skin: t(j.skin, 200), build: t(j.build, 200), dna: t(j.dna, 1600) };
}
/** Стилийн лавлах зургийн рендерийг үгээр (нэг удаа) — зургийг өөрийг нь генераторт өгөхгүй */
async function describeStyle(url: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !url) return "";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ model: process.env.AGENT_VISION_MODEL || WRITER(), max_completion_tokens: 400, reasoning_effort: "none", messages: [{ role: "user", content: [
      { type: "text", text: "Describe ONLY the rendering style of this image for an image-generation prompt: medium (CGI / photo / clay / painting / illustration), engine-like look, skin and material shading, hair rendering, lighting quality, color grading and palette, contrast, grain, overall finish. Ignore the people's identities, the layout, number of views, background, text and labels. One paragraph, max 70 words, English, no preamble." },
      { type: "image_url", image_url: { url: siteUrl(url) } },
    ] }] }),
  }).then((x) => x.json()).catch(() => ({}));
  return String(r?.choices?.[0]?.message?.content || "").trim().slice(0, 600);
}
type TwinIn = { ws: string; name: string; faces: string[]; bodies: string[]; hands: string[]; styleRef: string; profile: TwinProfile; style: TwinStyle; palette: TwinPalette; expr: TwinExpr; outfit: string[]; outfitLabels: string[]; sheets: TwinSheet[] };
async function brandColorOf(ws: string) { return ws === MAIN_WS ? "#2E29FF" : (await getBusiness(ws))?.brandColor || "#2E29FF"; }
async function twinJob(ws: string, personaId: string, kind: TwinSheet | "outfit" | "photo", t: { faces: string[]; bodies: string[]; hands: string[]; styleRef: string; styleText?: string; outfit: string[]; outfitLabels: string[]; profile: TwinProfile; style: TwinStyle; palette: TwinPalette; expr: TwinExpr; scene?: string }) {
  const pr = twinPrompt(kind, t.profile, { faces: t.faces, bodies: t.bodies, hands: t.hands, styleRef: t.styleRef, styleText: t.styleText, outfit: t.outfit }, { style: t.style, palette: t.palette, expr: t.expr, brandColor: await brandColorOf(ws), outfitLabels: t.outfitLabels, scene: t.scene });
  const label = kind === "outfit" ? `Хувцас: ${t.outfitLabels.join(", ") || "шинэ"}` : kind === "photo" ? "Зураг" : TWIN_SHEETS.find((x) => x.id === kind)?.label || kind;
  return mediaCreate({ ws, model: "flare", prompt: pr.prompt, enhance: false, ratio: pr.ratio, res: "medium", imageUrls: pr.urls, preset: `twin_${kind}`, idea: label, personaId });
}
export async function twinCreate(b: TwinIn & { ok?: boolean }) {
  await dbConnect();
  if (!b.ok) throw new Error("Зургийн зөвшөөрлийг баталгаажуулна уу");
  const faces = (b.faces || []).filter(Boolean).slice(0, 2);
  if (!faces.length) throw new Error("Нүүрний дор хаяж 1 зураг хэрэгтэй");
  if (!b.profile?.dna) throw new Error("Эхлээд «Шинжлэх» — агент таны онцлогийг тодорхойлно");
  const sheets = (b.sheets || []).filter((x): x is TwinSheet => ["head", "body", "sculpt"].includes(x));
  if (!sheets.length) throw new Error("Дор хаяж нэг sheet сонгоно уу");
  if ((await AgentPersona.countDocuments({ ws: b.ws })) >= 6) throw new Error("Ихэр 6-аас ихгүй байна — хуучнаа устгана уу");
  const first = !(await AgentPersona.exists({ ws: b.ws }));
  const styleText = b.styleRef ? await describeStyle(b.styleRef) : "";
  const t = { faces, bodies: (b.bodies || []).filter(Boolean).slice(0, 1), hands: (b.hands || []).filter(Boolean).slice(0, 1), styleRef: b.styleRef || "", styleText, outfit: (b.outfit || []).filter(Boolean).slice(0, 4), outfitLabels: (b.outfitLabels || []).slice(0, 4), profile: b.profile, style: b.style || "hyper", palette: b.palette || "dark_blue", expr: b.expr || "calm" };
  const per = await AgentPersona.create({ ws: b.ws, name: (b.name || "Миний ихэр").trim().slice(0, 40), photos: [...t.faces, ...t.bodies], status: "rendering", isDefault: first, ...t });
  let usd = 0;
  for (const kind of sheets) {
    try { usd += (await twinJob(b.ws, String(per._id), kind, t)).usd; }
    catch (e) { if (kind === sheets[0]) { await AgentPersona.deleteOne({ _id: per._id }); throw e; } }
  }
  return { id: String(per._id), usd: Math.round(usd * 1000) / 1000 };
}
type PerL = { _id: unknown; faces: string[]; bodies: string[]; hands: string[]; styleRef: string; styleText?: string; outfit: string[]; outfitLabels: string[]; profile: TwinProfile | null; style: TwinStyle; palette: TwinPalette; expr: TwinExpr; photos: string[] };
async function perFor(ws: string, id: string) {
  const p = await AgentPersona.findOne({ _id: id, ws }).lean<PerL>();
  if (!p) throw new Error("Ихэр олдсонгүй");
  if (!p.profile?.dna) throw new Error("Энэ хуучин дүр — «AI ихэр» хэсгээс шинээр бүтээнэ үү");
  return { ...p, faces: p.faces?.length ? p.faces : p.photos.slice(0, 1), profile: p.profile };
}
/** Шүүгээнээс хувцас өмсүүлэх — sheet (4 өнцөг) эсвэл нэг зураг (орчинтой) */
export async function twinDress(b: { ws: string; id: string; items: string[]; labels: string[]; mode: "outfit" | "photo"; scene?: string; save?: boolean }) {
  const p = await perFor(b.ws, b.id);
  const items = (b.items || []).filter(Boolean).slice(0, 4);
  if (!items.length && b.mode === "outfit") throw new Error("Өмсүүлэх хувцсаа сонгоно уу");
  const t = { ...p, outfit: items.length ? items : p.outfit, outfitLabels: items.length ? (b.labels || []).slice(0, 4) : p.outfitLabels, scene: b.scene };
  if (b.save && items.length) await AgentPersona.updateOne({ _id: b.id, ws: b.ws }, { $set: { outfit: items, outfitLabels: (b.labels || []).slice(0, 4) } });
  return twinJob(b.ws, b.id, b.mode === "photo" ? "photo" : "outfit", t);
}
export async function twinRegen(b: { ws: string; id: string; kind: TwinSheet; style?: TwinStyle; palette?: TwinPalette; expr?: TwinExpr }) {
  const p = await perFor(b.ws, b.id);
  const set: Record<string, unknown> = {};
  if (b.style) set.style = b.style; if (b.palette) set.palette = b.palette; if (b.expr) set.expr = b.expr;
  if (Object.keys(set).length) await AgentPersona.updateOne({ _id: b.id, ws: b.ws }, { $set: set });
  return twinJob(b.ws, b.id, b.kind, { ...p, ...(set as Partial<PerL>) } as Parameters<typeof twinJob>[3]);
}
export async function twinProfileSave(ws: string, id: string, profile: TwinProfile, name?: string) {
  await AgentPersona.updateOne({ _id: id, ws }, { $set: { profile, ...(name ? { name: name.slice(0, 40) } : {}) } });
  return {};
}
/** Шүүгээ: анхдагч 4 + хэрэглэгчийн оруулсан + бүтээгдэхүүний студиос салгасан хувцас */
export async function wardrobeFor(ws: string) {
  const own = await AgentWardrobe.find({ ws }).sort({ createdAt: -1 }).limit(60).lean<{ _id: unknown; url: string; label: string; part: string }[]>();
  const prods = await AgentProduct.find({ ws, "gallery.0": { $exists: true } }).select("name gallery category").lean<{ name: string; category: string; gallery: { url: string; kind: string; label: string }[] }[]>();
  const fromStudio = prods.flatMap((p) => p.gallery.filter((g) => g.kind === "image" && /салгах|ghost/i.test(g.label)).map((g) => ({ url: g.url, label: `${p.name} · ${g.label}`, part: "", source: "studio" as const })));
  return [
    ...DEFAULT_WARDROBE.map((w) => ({ ...w, source: "default" as const, id: "" })),
    ...own.map((w) => ({ url: w.url, label: w.label, part: w.part, source: "own" as const, id: String(w._id) })),
    ...fromStudio.map((w) => ({ ...w, id: "" })),
  ];
}
/** Gallery-гийн зургийг бүтээгдэхүүний үндсэн зураг болгоно */
export async function productMainImage(ws: string, productId: string, url: string) {
  const r = await AgentProduct.updateOne({ _id: productId, ws, $or: [{ "gallery.url": url }, { imageUrl: url }] }, { $set: { imageUrl: url } });
  if (!r.matchedCount) throw new Error("Зураг олдсонгүй");
  return {};
}
/* Медиа бэлэн болоход: бүтээгдэхүүний gallery-д нэмэх + дараагийн алхам (жишээ: салгасан зургийг эргүүлэх) */
async function afterDone(m: MediaL, url: string) {
  if (m.preset === "persona" && m.personaId) {
    await AgentPersona.updateOne({ _id: m.personaId, ws: m.ws || MAIN_WS }, { $set: { sheetUrl: url, status: "ready", error: "" } });
    return;
  }
  if ((m.preset || "").startsWith("twin_") && m.personaId) {
    const kind = (m.preset || "").slice(5);
    const per = await AgentPersona.findOne({ _id: m.personaId, ws: m.ws || MAIN_WS }).select("sheetUrl sheets").lean<{ sheetUrl: string; sheets: { kind: string }[] }>();
    if (!per) return;
    /* дараагийн бүх ажилд биеийн sheet хамгийн сайн лавлах (нүүр + бие + гар нэг дор) */
    const main = kind === "body" || (!per.sheetUrl && kind !== "sculpt") || (!per.sheetUrl && !per.sheets?.length);
    await AgentPersona.updateOne({ _id: m.personaId }, { $push: { sheets: { kind, url, mediaId: String(m._id), label: m.idea || kind, at: new Date() } }, $set: { status: "ready", error: "", ...(main ? { sheetUrl: url } : {}) } });
    return;
  }
  if (m.productId) {
    const label = IMAGE_PRESETS.find((x) => x.id === m.preset)?.label || MOTION_PRESETS.find((x) => x.id === m.preset)?.label || (m.kind === "video" ? "Видео" : "Зураг");
    await AgentProduct.updateOne({ _id: m.productId, ws: m.ws || MAIN_WS }, { $push: { gallery: { url, kind: m.kind, label, mediaId: String(m._id), at: new Date() } } });
  }
  if (m.then && m.kind === "image") {
    try { await motionRun({ ws: m.ws || MAIN_WS, preset: m.then, imageUrl: url, productId: m.productId || undefined }); }
    catch (e) { console.error("[agent] studio chain", (e as Error).message); }
  }
}
async function attach(m: MediaL, url: string) {
  if (!m.postId) return;
  const p = await TuqorPost.findById(m.postId).lean<PostL>();
  if (!p || String(p.mediaId) !== String(m._id)) return;
  const set: Record<string, unknown> = { mediaState: "ready", kind: m.kind, ...(m.kind === "video" ? { videoUrl: url } : { imageUrl: url, videoUrl: "" }) };
  await TuqorPost.updateOne({ _id: p._id }, { $set: set });
  if (p.queued && ["draft", "held"].includes(p.status)) {
    const at = new Date(Math.max(+new Date(p.at), Date.now() + 2 * 60e3));
    const r = await schedule({ ...p, ...set, at } as unknown as PostL);
    if (!r.ok) await TuqorPost.updateOne({ _id: p._id }, { $set: { status: "held", queued: false, holdReason: r.error } });
  }
}
export async function pollMedia(): Promise<{ running: number; done: number; failed: number }> {
  await dbConnect();
  const rows = await AgentMedia.find({ status: "running" }).sort({ createdAt: 1 }).limit(20).lean<MediaL[]>();
  let done = 0, failed = 0;
  for (const m of rows) {
    /* давхар татахгүйн тулд 90с түгжинэ (cron ба UI зэрэг шалгаж болно) */
    const claim = await AgentMedia.findOneAndUpdate({ _id: m._id, status: "running", $or: [{ pollUntil: null }, { pollUntil: { $lt: new Date() } }] }, { $set: { pollUntil: new Date(Date.now() + 90e3) } });
    if (!claim) continue;
    const fail = async (error: string) => {
      failed++;
      await AgentMedia.updateOne({ _id: m._id }, { $set: { status: "failed", error, pollUntil: null } });
      if (m.preset === "persona" && m.personaId) await AgentPersona.updateOne({ _id: m.personaId }, { $set: { status: "failed", error } });
      if ((m.preset || "").startsWith("twin_") && m.personaId) {
        /* ихрийн бүх sheet бүтэлгүйтсэн бөгөөд өөр ажил үлдээгүй бол л «амжилтгүй» */
        const per = await AgentPersona.findById(m.personaId).select("sheets").lean<{ sheets: unknown[] }>();
        const others = await AgentMedia.exists({ personaId: m.personaId, status: "running", _id: { $ne: m._id } });
        if (per && !per.sheets?.length && !others) await AgentPersona.updateOne({ _id: m.personaId }, { $set: { status: "failed", error } });
      }
      if (!m.postId) return;
      await TuqorPost.updateOne({ _id: m.postId, mediaId: String(m._id) }, { $set: { mediaState: "failed", holdReason: `Медиа: ${error}` } });
      await TuqorPost.updateOne({ _id: m.postId, mediaId: String(m._id), queued: true }, { $set: { status: "held", queued: false } });
    };
    try {
      if (Date.now() - +new Date(m.createdAt) > MEDIA_TTL) { await fail("Хугацаа хэтэрсэн (3 цаг)"); continue; }
      /* Google Nano Banana арын ажлаар дуусна; сервер дахин ассанаар тасарсан бол 10 мин-д унагаана */
      if ((m.endpoint || "").startsWith("google:")) {
        if (Date.now() - +new Date(m.createdAt) > 10 * 60e3) await fail("Хариу ирсэнгүй — дахин оролдоно уу");
        else await AgentMedia.updateOne({ _id: m._id }, { $set: { pollUntil: null } });
        continue;
      }
      /* Higgsfield завгүй байхад хүлээлгэсэн ажил → одоо илгээнэ */
      if (!m.requestId) {
        if (!m.job) { await fail("Илгээгдээгүй"); continue; }
        try {
          const { requestId, endpoint } = await hfSubmit(m.job.model, m.job.opts as unknown as HfOpts);
          await AgentMedia.updateOne({ _id: m._id }, { $set: { requestId, endpoint, job: null, pollUntil: null } });
        } catch (e) {
          const msg = (e as Error).message;
          if (HF_BUSY.test(msg)) await AgentMedia.updateOne({ _id: m._id }, { $set: { pollUntil: null } });
          else await fail(msg.slice(0, 200));
        }
        continue;
      }
      const st = await hfStatus(m.requestId);
      if (st.state === "failed") { await fail(st.error); continue; }
      if (st.state !== "done") { await AgentMedia.updateOne({ _id: m._id }, { $set: { pollUntil: null } }); continue; }
      const saved = await hfSave(st.url, m.kind);
      await AgentMedia.updateOne({ _id: m._id }, { $set: { status: "done", url: saved.url, pollUntil: null } });
      await attach(m, saved.url);
      await afterDone(m, saved.url).catch((e) => console.error("[agent] afterDone", (e as Error).message));
      done++;
    } catch (e) {
      console.error("[agent] media poll", (e as Error).message);
      await AgentMedia.updateOne({ _id: m._id }, { $set: { pollUntil: null } });
    }
  }
  /* амжилтгүй бүтээлтийн кредитийг гишүүнд буцаана (2026-10-26) */
  await refundFailedStudio().catch(() => 0);
  return { running: rows.length - done - failed, done, failed };
}
/** Бэлэн медиа → хэд хэдэн пост хувилбар (caption-ыг агент бичнэ, медиа хавсарна) */
export async function mediaToPost(id: string, b: { ws?: string; idea?: string; count?: number; audienceId?: string; platforms?: string[] }) {
  await dbConnect();
  const ws = b.ws || MAIN_WS;
  const m = await AgentMedia.findOne({ _id: id, ws }).lean<MediaL>();
  if (!m || m.status !== "done") throw new Error("Медиа бэлэн биш");
  const what = m.kind === "video" ? "AI видео" : "AI зураг";
  const text = `${b.idea?.trim() || m.idea || ""}\n\n(Энэ пост ${what}-той хамт нийтлэгдэнэ. Дүрслэл: ${m.prompt.slice(0, 500)})`.trim();
  const r = await createVariants({ ws, source: "idea", text, format: "post", count: Math.max(1, Math.min(4, b.count || 1)), audienceId: b.audienceId, platforms: b.platforms?.length ? b.platforms : ["threads", "instagram", "facebook"] });
  await TuqorPost.updateMany({ _id: { $in: r.posts.map((p) => p._id) } }, { $set: { kind: m.kind, mediaId: String(m._id), mediaState: "ready", ...(m.kind === "video" ? { videoUrl: m.url } : { imageUrl: m.url }) } });
  return { group: r.group };
}
export async function mediaDelete(id: string, ws: string = MAIN_WS) {
  await dbConnect();
  const m = await AgentMedia.findOne({ _id: id, ws }).lean<MediaL>();
  if (!m) return {};
  const live = await TuqorPost.exists({ status: { $in: ["scheduled", "published"] }, mediaId: id });
  if (live) throw new Error("Товлогдсон/нийтлэгдсэн постонд ашиглагдаж байна");
  await TuqorPost.updateMany({ mediaId: id, status: { $in: ["draft", "held", "failed", "deleted"] } }, { $set: { mediaId: "", mediaState: "", ...(m.kind === "video" ? { videoUrl: "" } : { imageUrl: "" }) } });
  await AgentMedia.deleteOne({ _id: id });
  if (m.url.startsWith("/uploads/agent-hf-")) await unlink(`${process.cwd()}/public${m.url}`).catch(() => {});
  return {};
}

/* ─── Нэг постын үйлдэл ───────────────────────────────────────────────── */
export async function postOp(id: string, op: string, b: { ws?: string; text?: string; at?: string; platforms?: string[]; spec?: IgSpec; theme?: IgTheme; metaAccount?: string; threadsUserId?: string; kind?: string; media?: MediaOpt; note?: string }) {
  await dbConnect();
  const ws = b.ws || MAIN_WS;
  /* өөр workspace-ийн постод хэзээ ч хүрэхгүй */
  const p = await TuqorPost.findOne({ _id: id, ws }).lean<PostL>();
  if (!p) throw new Error("Пост олдсонгүй");
  const cfg = await getConfig(ws);
  if (op === "media") {
    /* Постонд AI зураг/видео (Higgsfield). fromImage — одоогийн зургийг хөдөлгөөнтэй болгоно */
    const kind = b.kind === "video" ? "video" : "image";
    if (p.mediaState === "rendering") throw new Error("Медиа бүтээгдэж байна — түр хүлээнэ үү");
    if (!["draft", "held", "failed"].includes(p.status)) throw new Error("Товлогдсон постын медиаг солихгүй");
    await useGen(ws);
    const prompt = await visualPrompt(p.text, kind, { dur: b.media?.dur, ratio: b.media?.ratio, extra: b.note, ws });
    return startMedia(id, prompt, kind, b.media || {});
  }
  if (op === "detach") {
    if (!["draft", "held", "failed"].includes(p.status)) throw new Error("Товлогдсон постын медиаг хасахгүй");
    await TuqorPost.updateOne({ _id: id }, { $set: { imageUrl: p.kind === "infographic" ? p.imageUrl : "", videoUrl: "", mediaId: "", mediaState: "", queued: false, kind: p.kind === "infographic" ? "infographic" : "text", platforms: p.kind === "infographic" ? p.platforms : p.platforms.filter((x) => x !== "instagram") } });
    return {};
  }
  if (op === "fix") {
    const [r] = await polish([b.text ?? p.text], { spell: true, generic: cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT });
    await TuqorPost.updateOne({ _id: id }, { $set: { text: r.text, fixes: r.fixes, generic: r.generic } });
    if (p.status === "scheduled") await SocialPost.updateOne({ _id: p.socialPostId, state: "scheduled" }, { $set: { text: r.text } });
    return r;
  }
  if (op === "rerender") {
    const spec = { ...(p.infographic as unknown as IgSpec), ...(b.spec || {}) };
    const theme = b.theme || ((p.infographic as { theme?: IgTheme } | null)?.theme) || "light";
    const { url } = await renderInfographic(spec, theme);
    await TuqorPost.updateOne({ _id: id }, { $set: { imageUrl: url, infographic: { ...spec, theme }, kind: "infographic" } });
    if (p.status === "scheduled") await SocialPost.updateOne({ _id: p.socialPostId, state: "scheduled" }, { $set: { imageUrl: `${(process.env.PUBLIC_SITE_URL || "https://antaqor.com").replace(/\/$/, "")}${url}` } });
    return { imageUrl: url };
  }
  if (op === "duplicate") {
    const { _id, socialPostId, results, status, ...rest } = p; void _id; void socialPostId; void results; void status;
    const d = await TuqorPost.create({ ...rest, status: "draft", socialPostId: "", results: [], evaluated: false, doubled: false, queued: false, ...(rest.mediaState === "rendering" ? { mediaState: "", mediaId: "" } : {}) });
    return { id: String(d._id) };
  }
  if (op === "delete") {
    if (p.socialPostId) {
      const gone = await SocialPost.findOneAndDelete({ _id: p.socialPostId, state: "scheduled" });
      if (!gone && (await SocialPost.exists({ _id: p.socialPostId, state: { $in: ["publishing", "published"] } }))) throw new Error("Аль хэдийн нийтлэгдсэн");
    }
    await TuqorPost.updateOne({ _id: id }, { $set: { status: "deleted" } });
    return {};
  }
  if (op === "edit") {
    const set: Record<string, unknown> = {};
    if (typeof b.text === "string") set.text = b.text.slice(0, 2200);
    if (Array.isArray(b.platforms)) set.platforms = b.platforms.filter((x) => ["threads", "facebook", "instagram"].includes(x));
    if (b.at) { const at = new Date(b.at); if (!Number.isFinite(+at)) throw new Error("Цаг буруу"); set.at = at; set.day = ymd(at); }
    if (typeof b.metaAccount === "string") set.metaAccount = b.metaAccount;
    if (typeof b.threadsUserId === "string") set.threadsUserId = b.threadsUserId;
    if (p.status === "scheduled") {
      const r = await SocialPost.updateOne({ _id: p.socialPostId, state: "scheduled" }, { $set: { ...(set.text ? { text: String(set.text).trim() } : {}), ...(set.at ? { scheduledAt: set.at } : {}), ...(set.platforms ? { platforms: set.platforms } : {}) } });
      if (!r.matchedCount) throw new Error("Аль хэдийн нийтлэгдсэн");
    }
    await TuqorPost.updateOne({ _id: id }, { $set: set });
    return {};
  }
  if (op === "schedule" || op === "now") {
    if (!["draft", "held", "failed"].includes(p.status)) throw new Error("Аль хэдийн товлогдсон");
    const at = op === "now" ? new Date(Date.now() + 70e3) : b.at ? new Date(b.at) : new Date(p.at);
    if (+at < Date.now() + 60e3) throw new Error("Ирээдүйн цаг сонгоно уу");
    const platforms = (b.platforms?.length ? b.platforms : p.platforms).filter((x) => ["threads", "facebook", "instagram"].includes(x));
    const rendering = p.mediaState === "rendering";
    if (platforms.includes("instagram") && !p.imageUrl && !p.videoUrl && !rendering) throw new Error("Instagram-д зураг/видео хэрэгтэй (AI зураг нэмэх эсвэл Instagram-ыг хасах)");
    const set = { at, day: ymd(at), platforms, metaAccount: b.metaAccount ?? p.metaAccount, threadsUserId: b.threadsUserId ?? p.threadsUserId };
    if (rendering) {
      /* медиа бэлэн болмогц pollMedia товлоно */
      await TuqorPost.updateOne({ _id: id }, { $set: { ...set, queued: true, status: "draft" } });
      return { queued: true };
    }
    await TuqorPost.updateOne({ _id: id }, { $set: set });
    const r = await schedule({ ...p, ...set });
    if (!r.ok) throw new Error(r.error);
    /* нэг хувилбарыг сонгосон бол бусад хувилбар ноорог хэвээр — санд үлдэнэ */
    return {};
  }
  throw new Error("Үйлдэл буруу");
}

/* ─── Долоо хоногийн AI төлөвлөгч ──────────────────────────────────────── */
export async function planWeek(b: { ws?: string; prompt: string; platforms: string[]; perDay: number; audienceId?: string; days?: number }) {
  await dbConnect();
  const ws = b.ws || MAIN_WS;
  const days = Math.max(1, Math.min(14, b.days || 7)), perDay = Math.max(1, Math.min(4, b.perDay || 2));
  await useGen(ws, 5);
  const ctx = await contextBlock({ ws, idea: b.prompt, audienceId: b.audienceId, withProducts: true });
  const total = days * perDay;
  const r = await llm(ctx.system, `${ctx.context}\n\nЭЗНИЙ ЗОРИЛГО / ЧИГЛЭЛ:\n${b.prompt}\n\n${days} хоногийн төлөвлөгөө: өдөрт ${perDay}, нийт ${total} БЭЛЭН пост. Өдөр бүр өөр сэдэв, 7 хоног нэг түүх мэт өрнөнө; 4-5 пост тутамд нэг нь бүтээгдэхүүний санал. Хэлбэр холимог: богино цочрол, задлал, санал.\nЗөвхөн JSON массив: [{"day":1,"angle":"","text":"постын бүтэн текст"}]`, 9000, 0.9);
  const arr = json<{ day?: number; angle?: string; text?: string }[]>(r.text, []).filter((x) => String(x.text || "").trim().length > 10).slice(0, total);
  if (!arr.length) throw new Error("Төлөвлөгөө гарсангүй — дахин оролдоно уу");
  const cfg = ctx.cfg;
  const pol = await polish(arr.map((x) => String(x.text)), { spell: cfg.spellFix !== false, generic: cfg.generic?.length ? cfg.generic : GENERIC_DEFAULT });
  const preds = await predict(pol.map((p) => p.text), [], ws);
  const rules = await AgentRule.find({ ws, active: true }).lean<RuleL[]>();
  const hours = rules.length ? Array.from(new Set(rules.map((x) => x.hour))).sort((a, c) => a - c) : [8, 18, 21];
  const group = randomUUID();
  const made: PostL[] = [];
  const today = ubDayStart(new Date());
  const used: number[] = [];
  for (let k = 0; k < arr.length; k++) {
    const d = Math.max(1, Math.min(days, Number(arr[k].day) || Math.floor(k / perDay) + 1));
    const day0 = new Date(+today + d * DAY);
    const busy = [...(await busyTimes(day0, new Date(+day0 + DAY), ws)), ...used];
    let at: Date | null = null;
    for (const h of hours) { const t = ubAt(day0, h); if (!busy.some((x) => Math.abs(x - +t) < 60 * 60e3)) { at = t; break; } }
    if (!at) at = ubAt(day0, 12 + (k % 8));
    used.push(+at);
    const reasons = guard(pol[k].text, b.prompt, b.platforms);
    const doc = await TuqorPost.create({
      ws, day: ymd(at), at, text: pol[k].text, format: (Array.from(pol[k].text).length <= 180 ? "spark" : "value") as TuqorFormat, source: "idea", idea: b.prompt.slice(0, 500),
      platforms: b.platforms.filter((p) => p !== "instagram"), status: reasons.length ? "held" : "draft", holdReason: reasons.join(" · "), pred: preds[k], aiModel: r.model,
      audience: ctx.audience, variantGroup: group, angle: String(arr[k].angle || ""), fixes: pol[k].fixes, generic: pol[k].generic, origin: { src: "plan", sid: group },
    });
    const p = doc.toObject() as unknown as PostL;
    if (!reasons.length && cfg.auto) { const s = await schedule(p); if (!s.ok) await TuqorPost.updateOne({ _id: doc._id }, { $set: { status: "held", holdReason: s.error } }); }
    made.push((await TuqorPost.findById(doc._id).lean<PostL>())!);
  }
  return { group, made: made.length, scheduled: made.filter((m) => m.status === "scheduled").length };
}

/* ─── Хуваарийн дүрэм ─────────────────────────────────────────────────── */
export async function ensureRules(ws: string = MAIN_WS) {
  if (await AgentRule.exists({ ws })) return;
  if (ws !== MAIN_WS) {
    /* түрээслэгч: нэг санал болгох дүрэм (унтраалттай) — асаахад өдөр бүр өөрөө нийтэлнэ */
    await AgentRule.create({ ws, name: "Өдөр бүрийн пост", active: false, hour: 10, minute: 0, format: "value", source: "auto", topic: "Бизнесийн хэрэгтэй зөвлөгөө эсвэл бүтээгдэхүүний ашиг тус — ээлжлэн", platforms: ["facebook", "instagram"] });
    return;
  }
  await AgentRule.insertMany([
    { name: "Өглөөний AI мэдээ", hour: 8, minute: 0, format: "spark", source: "auto", topic: "AI салбарын шинэ хөдөлгөөн — богино, цочир" },
    { name: "Оройн санал", hour: 18, minute: 0, format: "offer", source: "product" },
    { name: "Шилдэг цагийн задлал", hour: 21, minute: 0, format: "value", source: "top", topic: "сайн ажилласан постоо шинэ өнцгөөр" },
  ]);
}
async function runRule(rule: RuleL, at: Date, cfg: Awaited<ReturnType<typeof getConfig>>) {
  const ws = rule.ws || MAIN_WS;
  const media = rule.format === "image" || rule.format === "video";
  const input: CreateInput = { ws, source: "idea", text: rule.topic || (ws === MAIN_WS ? "Өнөөдрийн сэдвийг өөрөө сонго — AI creator, систем, leverage" : "Өнөөдрийн сэдвийг өөрөө сонго — бизнесийн хэрэгтэй зөвлөгөө, бүтээгдэхүүний ашиг тус"), format: rule.format === "infographic" ? "infographic" : media ? (rule.format as "image" | "video") : "post", count: 2, audienceId: rule.audienceId || undefined, platforms: rule.platforms, mediaFor: "none" };
  if (rule.source === "notebook") {
    const n = await AgentNote.find({ ws }).sort({ updatedAt: -1 }).limit(15).lean();
    if (n.length) { input.source = "note"; input.noteId = String(n[Math.floor(Math.random() * n.length)]._id); }
  } else if (rule.source === "top") {
    const t = await TuqorVec.find({ ws, source: "own", platform: "threads", postedAt: { $lte: new Date(Date.now() - 14 * DAY), $gte: new Date(Date.now() - 120 * DAY) } }).sort({ score: -1 }).limit(10).select("key").lean<{ key: string }[]>();
    const usedKeys = new Set((await TuqorPost.find({ ws, "origin.src": "top", createdAt: { $gte: new Date(Date.now() - 30 * DAY) } }).select("origin").lean<{ origin: { sid: string } }[]>()).map((x) => x.origin.sid));
    const pick = t.find((x) => !usedKeys.has(x.key));
    if (pick) { input.source = "top"; input.postKey = pick.key; input.text = rule.topic; }
  } else if (rule.source === "product") {
    const p = rule.productId ? await AgentProduct.findOne({ _id: rule.productId, ws }).lean() : await AgentProduct.findOne({ ws, active: true }).sort({ updatedAt: 1 }).lean();
    if (p) { input.source = "product"; input.productId = String(p._id); input.text = rule.topic; await AgentProduct.updateOne({ _id: p._id }, { $set: { updatedAt: new Date() } }); }
  }
  const { posts, visuals } = await createVariants(input);
  const best = posts.filter((x) => !x.holdReason).sort((a, b) => b.pred.score * (0.6 + b.pred.novelty) - a.pred.score * (0.6 + a.pred.novelty))[0] || posts[0];
  await TuqorPost.updateOne({ _id: best._id }, { $set: { at, day: ymd(at), ruleId: String(rule._id), source: "auto", status: best.holdReason ? "held" : "draft" } });
  await TuqorPost.updateMany({ variantGroup: best.variantGroup, _id: { $ne: best._id } }, { $set: { status: "deleted" } });
  if (media) {
    /* зөвхөн шилдэгт медиа — бэлэн болмогц pollMedia товлоно (автомат асаалттай бол) */
    try {
      await startMedia(String(best._id), visuals[String(best._id)] || (await visualPrompt(best.text, rule.format as "image" | "video", { ws })), rule.format as "image" | "video", { fromImage: !!best.imageUrl });
      if (!best.holdReason && cfg.auto) await TuqorPost.updateOne({ _id: best._id }, { $set: { queued: true } });
    } catch (e) { await TuqorPost.updateOne({ _id: best._id }, { $set: { status: "held", mediaState: "failed", holdReason: (e as Error).message } }); }
    return String(best._id);
  }
  if (!best.holdReason && cfg.auto) {
    const r = await schedule({ ...best, at, platforms: best.platforms });
    if (!r.ok) await TuqorPost.updateOne({ _id: best._id }, { $set: { status: "held", holdReason: r.error } });
  }
  return String(best._id);
}
export async function runRules(now = new Date()) {
  await ensureRules();
  const today = ymd(now), wd = ub(now).wd;
  const out: string[] = [];
  /* бүх workspace-ийн идэвхтэй дүрэм; туршилт дууссан/хүлээлгийнх алгасна */
  const cfgs = new Map<string, Awaited<ReturnType<typeof getConfig>>>();
  const okWs = new Map<string, boolean>();
  for (const r of await AgentRule.find({ active: true }).lean<RuleL[]>()) {
    const ws = r.ws || MAIN_WS;
    if (!okWs.has(ws)) okWs.set(ws, ws === MAIN_WS || ["trial", "active"].includes(planOf((await AgentWorkspace.findOne({ wsId: ws }).lean()) as never).plan));
    if (!okWs.get(ws)) continue;
    if (!cfgs.has(ws)) cfgs.set(ws, await getConfig(ws));
    const cfg = cfgs.get(ws)!;
    if (r.lastRunDay === today || (r.days.length && !r.days.includes(wd))) continue;
    const at = ubAt(ubDayStart(now), r.hour, r.minute);
    if (+at < +now + 10 * 60e3) { await AgentRule.updateOne({ _id: r._id }, { $set: { lastRunDay: today } }); continue; }
    if (+at - +now > 3 * 3600e3) continue;
    await AgentRule.updateOne({ _id: r._id }, { $set: { lastRunDay: today } });
    /* Тэр цагийн ±60 мин-д ижил сувагт аль ч пост (эзний гараар товлосон ч) байвал алгасна */
    const near = await SocialPost.exists({ state: { $in: ["scheduled", "publishing", "published"] }, ws: ws === MAIN_WS ? { $in: ["", null] } : ws, platforms: { $in: r.platforms }, scheduledAt: { $gte: new Date(+at - 60 * 60e3), $lte: new Date(+at + 60 * 60e3) } });
    if (near) { out.push(`${r.name}: тэр цагт пост байна`); continue; }
    try { await runRule(r, at, cfg); out.push(`${r.name}: бэлэн`); } catch (e) { out.push(`${r.name}: ${(e as Error).message}`); }
  }
  return out;
}

/* ─── Цаг тутмын хяналт: хэмжүүр, тест, ялагчийг давтах ─────────────────── */
export async function hourly(force = false) {
  const cfg = await getConfig(MAIN_WS);
  if (!force && cfg.lastHourlyAt && Date.now() - +new Date(cfg.lastHourlyAt) < 55 * 60e3) return null;
  await TuqorConfig.updateOne({ key: "main" }, { $set: { lastHourlyAt: new Date() } });
  await syncVectors(true).catch(() => null);
  const live = await TuqorPost.find({ ws: MAIN_WS, status: "published", at: { $gte: new Date(Date.now() - 48 * 3600e3) } }).lean<PostL[]>();
  const med = await TuqorVec.aggregate([{ $match: { ws: MAIN_WS, source: "own", platform: "threads", postedAt: { $gte: new Date(Date.now() - 30 * DAY) } } }, { $sort: { score: 1 } }, { $group: { _id: null, s: { $push: "$score" } } }]);
  const arr: number[] = med[0]?.s || []; const median = arr.length ? arr[Math.floor(arr.length / 2)] : 0;
  let winners = 0;
  for (const p of live) {
    const ext = p.results.filter((r) => r.status === "ok" && r.externalId).map((r) => `${r.platform === "threads" ? "th_" : r.platform === "instagram" ? "ig_" : "fb_"}${r.externalId}`);
    const ins = await SocialInsight.find({ externalId: { $in: ext } }).lean();
    if (!ins.length) continue;
    const m = ins.reduce((a, x) => ({ likes: a.likes + x.likes, comments: a.comments + x.comments, shares: a.shares + x.shares, views: a.views + (x.views || 0), score: a.score + x.score }), { likes: 0, comments: 0, shares: 0, views: 0, score: 0 });
    const age = Date.now() - +new Date(p.at);
    const set: Record<string, unknown> = { metrics: { ...m, at: new Date() } };
    if (age >= 3600e3 && p.snaps.h1 < 0) set["snaps.h1"] = m.score;
    if (age >= 6 * 3600e3 && p.snaps.h6 < 0) { set["snaps.h6"] = m.score; set.evaluated = true; }
    if (age >= 24 * 3600e3 && p.snaps.h24 < 0) set["snaps.h24"] = m.score;
    await TuqorPost.updateOne({ _id: p._id }, { $set: set });
    /* Ялагч: 1 цагийн дотор 30 хоногийн медиан ×2 (≥10) — шинэчилсэн хувилбарыг маргааш нийтэлнэ */
    if (!p.doubled && winners < 1 && age >= 3600e3 && m.score >= Math.max(10, median * 2)) {
      winners++;
      await TuqorPost.updateOne({ _id: p._id }, { $set: { doubled: true } });
      try {
        const v = await TuqorVec.findOne({ key: { $in: ext } }).select("key").lean<{ key: string }>();
        if (v) {
          const { posts } = await createVariants({ source: "top", postKey: v.key, format: "post", count: 3, text: "Энэ пост дөнгөж сайн ажиллалаа — дараагийн өдөрт шинэ өнцгөөр" });
          const best = posts.filter((x) => !x.holdReason).sort((a, b) => b.pred.score - a.pred.score)[0];
          if (best) await TuqorPost.updateMany({ variantGroup: best.variantGroup, _id: { $ne: best._id } }, { $set: { status: "deleted" } });
          if (best && cfg.auto) {
            const tomorrow = new Date(+ubDayStart(new Date()) + DAY);
            const busy = await busyTimes(tomorrow, new Date(+tomorrow + DAY));
            const slot = [12, 15, 20, 22].map((h) => ubAt(tomorrow, h)).find((t) => !busy.some((b) => Math.abs(b - +t) < 90 * 60e3));
            if (slot) { await TuqorPost.updateOne({ _id: best._id }, { $set: { at: slot, day: ymd(slot), source: "auto" } }); await schedule({ ...best, at: slot }); }
          }
        }
      } catch (e) { console.error("[agent] winner", e); }
    }
  }
  return { checked: live.length, winners, median };
}

/* Түрээслэгчийн цагийн хяналт: өөрийн Threads-ийг татаж (vector + оноо), нийтэлсэн постын
   хэмжүүрийг TuqorVec-ээс шинэчилнэ (SocialInsight нь зөвхөн эзнийх). Нэг tick-д ≤3 workspace. */
export async function hourlyWs(): Promise<string[]> {
  const out: string[] = [];
  const wss = await AgentWorkspace.find({ plan: { $in: ["trial", "active"] } }).select("wsId plan trialEndsAt paidUntil").lean();
  let n = 0;
  for (const w of wss) {
    if (n >= 3) break;
    if (planOf(w as never).plan === "expired") continue;
    const cfg = await getConfig(w.wsId);
    if (cfg.lastHourlyAt && Date.now() - +new Date(cfg.lastHourlyAt) < 55 * 60e3) continue;
    n++;
    await TuqorConfig.updateOne({ key: w.wsId }, { $set: { lastHourlyAt: new Date() } });
    try {
      await syncVectors(true, w.wsId);
      const live = await TuqorPost.find({ ws: w.wsId, status: "published", at: { $gte: new Date(Date.now() - 72 * 3600e3) } }).lean<PostL[]>();
      for (const p of live) {
        const keys = p.results.filter((r) => r.status === "ok" && r.externalId && r.platform === "threads").map((r) => `th_${r.externalId}`);
        if (!keys.length) continue;
        const vs = await TuqorVec.find({ key: { $in: keys } }).select("likes comments views score").lean<{ likes: number; comments: number; views: number; score: number }[]>();
        if (!vs.length) continue;
        const m = vs.reduce((a, x) => ({ likes: a.likes + (x.likes || 0), comments: a.comments + (x.comments || 0), shares: 0, views: a.views + (x.views || 0), score: a.score + (x.score || 0) }), { likes: 0, comments: 0, shares: 0, views: 0, score: 0 });
        const age = Date.now() - +new Date(p.at);
        await TuqorPost.updateOne({ _id: p._id }, { $set: { metrics: { ...m, at: new Date() }, ...(age >= 6 * 3600e3 ? { evaluated: true } : {}) } });
      }
      out.push(`${w.wsId}: ok`);
    } catch (e) { out.push(`${w.wsId}: ${(e as Error).message}`); }
  }
  return out;
}

/* ─── cron: 5 мин тутам ──────────────────────────────────────────────── */
let adminId: unknown = null;
export async function agentTick() {
  await dbConnect();
  await getConfig();
  const lock = await TuqorConfig.findOneAndUpdate({ key: "main", $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }] }, { $set: { lockedUntil: new Date(Date.now() + 8 * 60e3) } }, { new: true }).lean<{ auto: boolean; runHour: number; lastAskDay: string }>();
  if (!lock) return { skipped: "locked" };
  const out: Record<string, unknown> = {};
  try {
    /* нийтлэлийн төлөв */
    const live = await TuqorPost.find({ status: "scheduled", socialPostId: { $ne: "" } }).lean<PostL[]>();
    const sps = await SocialPost.find({ _id: { $in: live.map((p) => p.socialPostId) } }).select("state results lastError").lean();
    /* (бүх workspace — SocialPost-ын төлөвийг постонд буулгана) */
    const byId = new Map(sps.map((s) => [String(s._id), s]));
    for (const p of live) {
      const s = byId.get(p.socialPostId);
      if (!s) { await TuqorPost.updateOne({ _id: p._id }, { $set: { status: "draft", socialPostId: "" } }); continue; }
      if (s.state === "published" || s.state === "failed") await TuqorPost.updateOne({ _id: p._id }, { $set: { status: s.state, holdReason: s.state === "failed" ? s.lastError || "Нийтлэхэд алдаа" : "", results: s.results.map((r) => ({ platform: r.platform, status: r.status, permalink: r.permalink || "", externalId: r.externalId || "" })) } });
    }
    out.media = await pollMedia().catch((e) => ({ error: (e as Error).message }));
    out.hourly = await hourly();
    out.tenants = await hourlyWs().catch((e) => [(e as Error).message]);
    out.rules = await runRules();
    const today = ymd(new Date());
    if (lock.lastAskDay !== today && ub(new Date()).h >= lock.runHour) {
      if (!adminId) adminId = (await User.findOne({ email: SUPER_ADMIN_EMAILS[0] }).select("_id").lean<{ _id: unknown }>())?._id || null;
      if (adminId) await Notification.create({ recipient: adminId, type: "system", title: AGENT_NAME, message: `${ASKS[ub(new Date()).wd % ASKS.length]} — нэг санаа хэлбэл хэд хэдэн хувилбар болгоно.`, link: "/content-agent?v=create" }).catch(() => {});
      await TuqorConfig.updateOne({ key: "main" }, { $set: { lastAskDay: today } });
    }
  } finally {
    await TuqorConfig.updateOne({ key: "main" }, { $set: { lockedUntil: null } });
  }
  return out;
}
