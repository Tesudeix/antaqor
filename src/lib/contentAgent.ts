import { randomUUID, randomBytes } from "crypto";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import sharp from "sharp";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import ContentPlan, { type IContentPlan, type IPlanSlot } from "@/models/ContentPlan";
import AgentBrand, { type IAgentBrand } from "@/models/AgentBrand";
import SocialPost from "@/models/SocialPost";
import SocialInsight, { SocialPlaybook } from "@/models/SocialInsight";
import ThreadsToken from "@/models/ThreadsToken";
import AiImage from "@/models/AiImage";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { providers, chatCompletion, type Provider } from "@/lib/scoutProvider";
import { getBrand, brandPromptBlock } from "@/lib/brandProfile";
import { stats as socialStats, parseJson } from "@/lib/socialInsights";
import { VOICE_SPEC } from "@/lib/threadsVoice";
import { generateNanoBanana } from "@/lib/nanoBanana";
import { validate, scheduleDate, type SocialPlatform } from "@/lib/socialInput";
import { SUPER_ADMIN_EMAILS } from "@/lib/adminAuth";
import { DAY, ub, ubAt, weekStartOf, hm, md, WEEKDAYS, isoWeek, weekLabel, checkSlot } from "@/lib/contentAgentRules";

/* ─── КОНТЕНТ АГЕНТ (2026-10-23) ──────────────────────────────────────────
   7 хоног бүр: өгөгдөл унших → стратеги + слот → слот бүрийн ноорог → зураг
   → ХҮН батална → SocialPost (scheduled) → /api/cron/social-schedule нийтэлнэ.

   Шинэ нийтлэгч, шинэ дараалал, шинэ AI chain бичээгүй — бүгд одоо байгаа:
   scoutProvider (AI), nanoBanana (зураг), SocialPost + social-schedule (нийтлэх),
   SocialInsight (хэмжүүр), BrandProfile + SocialPlaybook (antaqor-ын дуу хоолой).

   Ажилчин (`advance`) нь урт ажил: Next-ийн route хариугаа өгсний дараа
   үргэлжилнэ (pm2 урт настай процесс). Restart болсон ч `lockedUntil`
   дууссаны дараа cron эсвэл хуудас ачаалах нь үргэлжлүүлнэ — ажил алдагдахгүй. */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const origin = () => (process.env.PUBLIC_SITE_URL || "https://antaqor.com").replace(/\/+$/, "");
export const abs = (u: string) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${origin()}${u.startsWith("/") ? "" : "/"}${u}`);
type Lean<T> = Omit<T, keyof import("mongoose").Document> & { _id: Types.ObjectId };
type PlanL = Lean<IContentPlan>;
type BrandL = Lean<IAgentBrand>;

/* ─── Брэнд ─────────────────────────────────────────────────────────────── */
const PERSONAL_PILLARS = [
  { name: "Туршлага", share: 30, hint: "Би юу хийсэн, юу харсан — бодит процесс, тоотой. «Ингэж хийсэн → ийм гарсан»" },
  { name: "Задлал", share: 25, hint: "Нэг ажиглалтыг 3 шалтгаан эсвэл 3 алхмаар задлах" },
  { name: "Хэрэгсэл + промт", share: 20, hint: "Нэг AI хэрэгсэл + нэг бодит асуудал + бэлэн промт" },
  { name: "Байр суурь", share: 15, hint: "Хурц, маргаан үүсгэх байр суурь — High Agency, Asymmetric" },
  { name: "Урилга", share: 10, hint: "Antaqor хүрээлэл / хичээл рүү шууд урих — яагаад одоо" },
];
const PRODUCT_PILLARS = [
  { name: "Танилцуулга", share: 25, hint: "Бүтээгдэхүүн юу вэ, хэнд зориулсан — нэг тод өгүүлбэр" },
  { name: "Асуудал → шийдэл", share: 25, hint: "Худалдан авагчийн өдөр тутмын нэг асуудал ба бүтээгдэхүүн хэрхэн шийддэг" },
  { name: "Хэрэглээ", share: 20, hint: "Яаж хэрэглэх, хэзээ хэрэгтэй — бодит нөхцөл байдал" },
  { name: "Итгэл", share: 15, hint: "Зөвхөн баталгаатай баримт: материал, гарал, баталгаа, ард нь байгаа хүмүүс" },
  { name: "Санал", share: 15, hint: "Үнэ / урамшуулал / хаанаас авах — тодорхой CTA" },
];
const VISUAL_ANTAQOR = "Cinematic editorial photography, deep black #0A0A0A background with a single cobalt blue (#2E29FF) accent light, minimal composition, lots of negative space, moody, premium, modern Mongolia / Ulaanbaatar context when a place is shown";

export async function ensureBrands(): Promise<void> {
  await dbConnect();
  try {
    if (!(await AgentBrand.exists({ key: "antaqor" }))) {
      const th = (await ThreadsToken.findOne({ username: /antaqor/i }).lean<{ threadsUserId: string }>()) || (await ThreadsToken.findOne({}).lean<{ threadsUserId: string }>());
      await AgentBrand.create({
        key: "antaqor", name: "Antaqor", kind: "personal", active: true, runWeekday: 1, runHour: 9, postsPerWeek: 7, maxPerDay: 2,
        hours: [21, 12], channels: ["threads", "facebook", "instagram"], metaAccount: "antaqor", threadsUserId: th?.threadsUserId || "",
        imageMode: "auto", imageShare: 30, visualStyle: VISUAL_ANTAQOR, pillars: PERSONAL_PILLARS,
        lastRunAt: new Date(), // анхны суулгалт: энэ 7 хоногийн ажлыг гараар эхлүүлнэ, автомат нь дараагийн Даваагаас
      });
    }
    if (!(await AgentBrand.exists({ key: "hooji" }))) {
      await AgentBrand.create({
        key: "hooji", name: "Hooji", kind: "product", active: false, postsPerWeek: 5, maxPerDay: 1, hours: [12, 20],
        channels: [], imageMode: "auto", imageShare: 70, pillars: PRODUCT_PILLARS, lastRunAt: new Date(),
        visualStyle: "Clean commercial product photography, soft natural light, real-life Mongolian home or street context, warm and trustworthy",
      });
    }
  } catch (e) { if ((e as { code?: number }).code !== 11000) throw e; }
}

export type Readiness = { ok: boolean; items: { label: string; ok: boolean }[] };
export function readiness(b: Pick<IAgentBrand, "kind" | "channels" | "metaAccount" | "threadsUserId" | "hours" | "pillars" | "product">): Readiness {
  const items: { label: string; ok: boolean }[] = [
    { label: "Ядаж нэг суваг", ok: b.channels.length > 0 },
    { label: "Нийтлэх цаг", ok: b.hours.length > 0 },
    { label: "Контентын багана", ok: b.pillars.some((p) => p.name.trim()) },
  ];
  if (b.channels.some((c) => c !== "threads")) items.push({ label: "Facebook / Instagram аккаунт", ok: !!b.metaAccount });
  if (b.channels.includes("threads")) items.push({ label: "Threads аккаунт", ok: !!b.threadsUserId });
  if (b.kind === "product") {
    items.push({ label: "Бүтээгдэхүүний нэр, тайлбар", ok: !!(b.product?.name?.trim() && b.product?.description?.trim()) });
    items.push({ label: "Ядаж 2 баталгаатай баримт", ok: (b.product?.facts || []).filter((f) => f.trim()).length >= 2 });
    items.push({ label: "CTA — хаанаас, яаж авах", ok: !!(b.product?.cta?.trim() || b.product?.link?.trim()) });
  }
  return { ok: items.every((i) => i.ok), items };
}

/* ─── AI ────────────────────────────────────────────────────────────────── */
/* Зохиол бага тоотой, өндөр эрсдэлтэй → бичигч загвар (Threads бичигчтэй ижил шийдэл).
   Сонгосон загвар нь chain-ийг ДАХИН ЭРЭМБЭЛНЭ, орлохгүй: OpenAI унавал Gemini үргэлжлүүлнэ. */
function chain(): Provider[] {
  const model = process.env.CONTENT_AGENT_MODEL || process.env.THREADS_WRITER_MODEL || "gpt-5.4";
  return providers().map((p) => (p.name === "openai" ? { ...p, model } : p));
}
async function llm(system: string, user: string, o: { maxTokens: number; reasoning: "none" | "low"; temperature?: number }): Promise<{ text: string; model: string }> {
  const fails: string[] = [];
  for (const p of chain()) {
    try {
      const c = await chatCompletion(p, [{ role: "system", content: system }, { role: "user", content: user }], {
        maxTokens: o.maxTokens, temperature: o.temperature ?? 0.8, reasoning: o.reasoning, timeoutMs: 120_000,
        onAttempt: (a) => { if (!a.ok) fails.push(`${a.name}: ${a.code || a.status || ""} ${a.message || ""}`.trim()); },
      });
      const raw = String(c?.message?.content || "").trim();
      if (raw) return { text: raw, model: `${p.name}:${p.model}` };
    } catch (e) { fails.push(`${p.name}: ${(e as Error).message}`); }
  }
  throw new Error(`AI хариу өгсөнгүй — ${fails.slice(0, 3).join(" · ") || "provider алга"}`);
}

function productBlock(b: BrandL): string {
  const p = b.product;
  const L = (t: string, a: string[]) => (a.filter((x) => x.trim()).length ? `${t}:\n${a.filter((x) => x.trim()).map((x) => `· ${x}`).join("\n")}` : "");
  return [
    "", "─── БҮТЭЭГДЭХҮҮНИЙ БРИФ ───",
    `НЭР: ${p.name || b.name}`, p.oneLiner && `НЭГ ӨГҮҮЛБЭРЭЭР: ${p.oneLiner}`, p.description && `ТАЙЛБАР: ${p.description}`,
    p.audience && `ХЭНД: ${p.audience}`, p.price && `ҮНЭ: ${p.price}`, p.offer && `САНАЛ / УРАМШУУЛАЛ: ${p.offer}`,
    p.cta && `CTA: ${p.cta}`, p.link && `ХОЛБООС: ${p.link}`,
    L("ДАВУУ ТАЛ", p.usps), L("БАТАЛГААТАЙ БАРИМТ (зөвхөн эдгээрийг тоо, баримт болгон ашиглана)", p.facts),
    L("ХЭЗЭЭ Ч БИЧИХГҮЙ / АМЛАХГҮЙ", p.banned), b.voiceNotes && `ДУУ ХООЛОЙ: ${b.voiceNotes}`,
    "", "ХАТУУ ДҮРЭМ: Брифэд байхгүй тоо, үнэ, хувь, хугацаа, шагнал, хэрэглэгчийн сэтгэгдэл, «олон хүн сонгосон» мэт нотлогдоогүй зүйл ЗОХИОХГҮЙ. Эрүүл мэнд, эмчилгээний амлалт өгөхгүй. Өрсөлдөгчийг нэрлэж муулахгүй.",
  ].filter(Boolean).join("\n");
}
async function voiceBlock(b: BrandL): Promise<string> {
  if (b.kind === "product") return productBlock(b);
  const bp = await getBrand();
  return `${b.key === "antaqor" ? VOICE_SPEC.replace(/\nДУУДЛАГА \(CTA\)[\s\S]*$/, "") : ""}\n${brandPromptBlock(bp)}${b.voiceNotes ? `\n\nНЭМЭЛТ ЗААВАР: ${b.voiceNotes}` : ""}`;
}
const line = (r: { platform: string; mediaType: string; score: number; likes: number; comments: number; views?: number; caption: string }) =>
  `[${r.platform}/${r.mediaType || "?"} · оноо ${r.score} · ❤${r.likes} 💬${r.comments}${r.views ? ` 👁${r.views}` : ""}] ${r.caption.replace(/\s+/g, " ").slice(0, 260)}`;

/* ─── Өгөгдөл ──────────────────────────────────────────────────────────── */
type Ctx = {
  stats: Awaited<ReturnType<typeof socialStats>> | null;
  playbook: { summary?: string; doList?: string[]; avoid?: string[]; hooks?: string[] } | null;
  recent: { platform: string; mediaType: string; score: number; likes: number; comments: number; views: number; caption: string; postedAt: Date }[];
  top: { platform: string; mediaType: string; score: number; likes: number; comments: number; caption: string }[];
  low: { platform: string; mediaType: string; score: number; likes: number; comments: number; caption: string }[];
  external: { at: Date; brief: string; text: string }[];
  prev: PlanL | null;
  captions: string[];
};
function accountFilter(b: BrandL) {
  if (b.kind === "personal" && b.key === "antaqor") return {};
  const acc = [b.metaAccount].filter(Boolean);
  return acc.length ? { account: { $in: acc } } : { account: "__none__" };
}
export function externalQuery(b: Pick<IAgentBrand, "metaAccount" | "threadsUserId">, from: Date, to: Date, exclude: string[] = []) {
  const who: Record<string, string>[] = [];
  if (b.metaAccount) who.push({ metaAccount: b.metaAccount });
  if (b.threadsUserId) who.push({ threadsUserId: b.threadsUserId });
  return {
    _id: { $nin: exclude.filter(Boolean) },
    state: { $in: ["scheduled", "publishing", "published"] },
    ...(who.length ? { $and: [{ $or: who }] } : { _id: { $in: [] } }),
    $or: [{ scheduledAt: { $gte: from, $lt: to } }, { scheduledAt: null, createdAt: { $gte: from, $lt: to } }],
  };
}
async function buildContext(b: BrandL, weekStart: Date, exclude: string[]): Promise<Ctx> {
  const f = accountFilter(b);
  const withCap = { ...f, caption: { $nin: ["", null] } };
  const personal = b.kind === "personal";
  const [stats, playbook, recent, top, low, ext, prev, caps] = await Promise.all([
    personal ? socialStats(90) : Promise.resolve(null),
    personal ? SocialPlaybook.findOne({ key: "antaqor" }).lean<Ctx["playbook"]>() : Promise.resolve(null),
    SocialInsight.find({ ...withCap, postedAt: { $gte: new Date(Date.now() - 7 * DAY) } }).sort({ score: -1 }).limit(30).lean(),
    SocialInsight.find(withCap).sort({ score: -1 }).limit(6).lean(),
    SocialInsight.find({ ...withCap, postedAt: { $lte: new Date(Date.now() - 3 * DAY) } }).sort({ score: 1 }).limit(3).lean(),
    SocialPost.find(externalQuery(b, weekStart, new Date(weekStart.getTime() + 7 * DAY), exclude)).select("scheduledAt createdAt brief text").lean(),
    ContentPlan.findOne({ brand: b.key, weekStart: new Date(weekStart.getTime() - 7 * DAY), active: true }).lean<PlanL>(),
    SocialInsight.find(withCap).sort({ postedAt: -1 }).limit(30).select("caption").lean(),
  ]);
  return {
    stats, playbook,
    recent: recent.map((r) => ({ platform: r.platform, mediaType: r.mediaType, score: r.score, likes: r.likes, comments: r.comments, views: r.views, caption: r.caption, postedAt: r.postedAt })),
    top, low,
    external: ext.map((p) => ({ at: (p.scheduledAt || p.createdAt) as Date, brief: p.brief || "", text: p.text || "" })),
    prev,
    captions: caps.map((c) => c.caption),
  };
}

/** Слотын цагийг ТОДОРХОЙЛОГЧ байдлаар хуваарилна (AI цаг сонгохгүй — алдаа гаргадаг хэсэг).
 *  Өдөр бүрт: брэндийн цагууд − өнгөрсөн − аль хэдийн товлосон постоос ±90 мин; өдрийн дээд хязгаар
 *  нь товлогдсон постуудыг оруулж тооцно. Эхний тойрогт гол цаг, дараа нь дараагийнх. */
export function distribute(b: Pick<IAgentBrand, "hours" | "maxPerDay" | "postsPerWeek">, weekStart: Date, external: Date[], now = new Date()): Date[] {
  const minAt = now.getTime() + 2 * 3600e3;
  const hours = Array.from(new Set(b.hours.filter((h) => h >= 0 && h <= 23)));
  const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY));
  const remaining = days.filter((d) => d.getTime() + DAY > minAt).length;
  const target = Math.max(1, Math.round((b.postsPerWeek * remaining) / 7));
  const plan = days.map((d) => {
    const ext = external.filter((x) => x.getTime() >= d.getTime() && x.getTime() < d.getTime() + DAY);
    const cands = hours.map((h) => ubAt(d, h)).filter((t) => t.getTime() >= minAt && !ext.some((x) => Math.abs(x.getTime() - t.getTime()) < 90 * 60e3));
    return { cands, cap: Math.max(0, b.maxPerDay - ext.length), picked: [] as Date[] };
  });
  let total = 0;
  for (let r = 0; r < 4 && total < target; r++) {
    for (const d of plan) {
      if (total >= target) break;
      if (d.picked.length < d.cap && d.cands[r]) { d.picked.push(d.cands[r]); total++; }
    }
  }
  return plan.flatMap((d) => d.picked).sort((a, b2) => a.getTime() - b2.getTime());
}

/* ─── Атомик бичилт ─────────────────────────────────────────────────────── */
export async function setSlot(planId: string | Types.ObjectId, slotId: string, set: Record<string, unknown>, guard: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const $set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(set)) $set[`slots.$[s].${k}`] = v;
  const filter: Record<string, unknown> = { "s.id": slotId };
  for (const [k, v] of Object.entries(guard)) filter[`s.${k}`] = v;
  const update: Record<string, unknown> = { ...extra };
  if (Object.keys($set).length) update.$set = $set;
  return ContentPlan.updateOne({ _id: planId }, update, { arrayFilters: [filter] });
}
async function log(planId: string | Types.ObjectId, step: string, ok: boolean, detail = "") {
  await ContentPlan.updateOne({ _id: planId }, { $push: { log: { $each: [{ at: new Date(), step, ok, detail: detail.slice(0, 400) }], $slice: -80 } } });
}
export function kick(planId: unknown) { void advance(String(planId)).catch((e) => console.error("[content-agent] advance", e)); }

/* ─── Ажилчин ──────────────────────────────────────────────────────────── */
export async function advance(planId: string, budgetMs = 110_000): Promise<void> {
  await dbConnect();
  const t0 = Date.now();
  const lock = await ContentPlan.findOneAndUpdate(
    { _id: planId, status: { $in: ["planning", "writing"] }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: new Date() } }] },
    { $set: { lockedUntil: new Date(Date.now() + 4 * 60e3) } },
    { new: true }
  ).lean<PlanL>();
  if (!lock) return;
  /* Түгжээ дууссан үед "writing"/"working" үлдсэн бол өмнөх процесс тасарсан — дахин дараалалд */
  for (const s of lock.slots) {
    if (s.status === "writing") await setSlot(planId, s.id, { status: "queued" }, { status: "writing" });
    if (s.imageState === "working") await setSlot(planId, s.id, { imageState: "queued" }, { imageState: "working" });
  }
  let more = false;
  try {
    const brand = await AgentBrand.findOne({ key: lock.brand }).lean<BrandL>();
    if (!brand) throw new Error("Брэнд олдсонгүй");
    if (lock.status === "planning") await doPlan(lock, brand);
    for (;;) {
      if (Date.now() - t0 > budgetMs) { more = true; break; }
      const plan = await ContentPlan.findById(planId).lean<PlanL>();
      if (!plan || !["planning", "writing"].includes(plan.status)) break;
      const q = plan.slots.find((s) => s.status === "queued");
      if (q) { await doWrite(plan, q, brand); continue; }
      const im = plan.slots.find((s) => s.imageState === "queued" && s.status !== "skipped" && s.status !== "error");
      if (im) { await doImage(plan, im, brand); continue; }
      await ContentPlan.updateOne({ _id: planId, status: { $in: ["planning", "writing"] } }, { $set: { status: "ready", error: "" } });
      if (!plan.notified && plan.createdBy === "cron") await notifyReady(plan, brand);
      break;
    }
  } catch (e) {
    const msg = (e as Error).message || "Алдаа";
    await ContentPlan.updateOne({ _id: planId }, { $set: { status: "failed", error: msg } });
    await log(planId, "Төлөвлөгөө", false, msg);
  } finally {
    await ContentPlan.updateOne({ _id: planId }, { $set: { lockedUntil: null } });
  }
  if (more) setTimeout(() => kick(planId), 500);
}

async function doPlan(plan: PlanL, b: BrandL) {
  const ctx = await buildContext(b, plan.weekStart, []);
  await log(plan._id, "Өгөгдөл", true, `${ctx.recent.length} пост (7 хоног) · ${ctx.external.length} товлогдсон · ${ctx.top.length} жишээ`);
  const times = distribute(b, plan.weekStart, ctx.external.map((x) => new Date(x.at)));
  if (!times.length) throw new Error("Энэ 7 хоногт сул цаг үлдсэнгүй — өдрийн дээд хязгаар дүүрсэн эсвэл цаг өнгөрсөн байна.");
  const pillars = b.pillars.filter((p) => p.name.trim());
  const st = ctx.stats;
  const prevLines = (ctx.prev?.slots || []).filter((s) => s.status === "published").map((s) => `· ${s.pillar} / ${s.format} / ${WEEKDAYS[ub(s.at).wd]} ${hm(s.at)} → оноо ${s.metrics?.score || 0} — «${(s.caption || s.hook).split("\n")[0].slice(0, 80)}»`);
  const imageRule = b.imageMode === "off" ? "Бүх слот format = \"text\"." : `Нийт слотын ойролцоогоор ${b.imageShare}% нь format = "image", үлдсэн нь "text".`;
  const system = `Чи ${b.name}-ийн сошиал медиагийн КОНТЕНТ СТРАТЕГИЧ агент. Монгол хэлээр бичнэ. Зөвхөн өгөгдсөн өгөгдөлд тулгуурла: зохиомол тоо, хүн, түүх, сэтгэгдэл БҮҮ зохио. Өгөгдөл байхгүй бол үүнийгээ шударгаар хэл. Зөвхөн JSON буцаа.\n${await voiceBlock(b)}`;
  const user = [
    `7 ХОНОГ: ${weekLabel(plan.weekStart)} (${isoWeek(plan.weekStart)}-р 7 хоног)`,
    `ЭЗНИЙ ТЭМДЭГЛЭЛ (энэ 7 хоногт онцлох): ${plan.note || "алга"}`,
    "",
    st ? `СҮҮЛИЙН 90 ХОНОГИЙН ӨГӨГДӨЛ: ${st.total} пост · шилдэг формат ${st.bestFormat} · шилдэг гараг ${st.bestDay} · шилдэг цаг ${st.bestHour} · шилдэг урт ${st.bestLength} · дундаж оноо ${st.avgScore}` : "ӨГӨГДӨЛ: энэ брэндийн хэмжүүр хараахан алга (шинэ суваг).",
    ctx.playbook?.summary ? `PLAYBOOK: ${ctx.playbook.summary}\nХИЙХ: ${(ctx.playbook.doList || []).join("; ")}\nБҮҮ ХИЙ: ${(ctx.playbook.avoid || []).join("; ")}` : "",
    ctx.recent.length ? `ӨНГӨРСӨН 7 ХОНОГИЙН ПОСТУУД (оноогоор):\n${ctx.recent.slice(0, 5).map(line).join("\n")}${ctx.recent.length > 5 ? `\n…СУЛ:\n${ctx.recent.slice(-3).map(line).join("\n")}` : ""}` : "ӨНГӨРСӨН 7 ХОНОГТ ПОСТ АЛГА.",
    prevLines.length ? `ӨМНӨХ 7 ХОНОГИЙН АГЕНТЫН ПОСТУУДЫН ҮР ДҮН:\n${prevLines.join("\n")}` : "",
    ctx.external.length ? `ЭНЭ 7 ХОНОГТ АЛЬ ХЭДИЙН ТОВЛОГДСОН (сэдвийг нь давтахгүй):\n${ctx.external.map((x) => `· ${WEEKDAYS[ub(x.at).wd]} ${hm(x.at)} — ${(x.brief || x.text).replace(/\s+/g, " ").slice(0, 110)}`).join("\n")}` : "",
    "",
    `КОНТЕНТЫН БАГАНА (хувь хэмжээг баримтал):\n${pillars.map((p) => `· ${p.name} (${p.share}%) — ${p.hint}`).join("\n")}`,
    "",
    `СЛОТУУД (цаг нь тогтсон, өөрчлөхгүй):\n${times.map((t, i) => `${i + 1}. ${WEEKDAYS[ub(t).wd]} ${md(t)} ${hm(t)}`).join("\n")}`,
    "",
    "ДААЛГАВАР:",
    "1. Энэ 7 хоногийн НЭГ гол сэдэв (theme, 2-6 үг), зорилго (goal, 1 өгүүлбэр), стратеги (summary, 2 өгүүлбэр).",
    "2. Өгөгдлөөс сурсан 3 дүгнэлт (learned) — тус бүр нэг өгүүлбэр, өгөгдлийн тоо/баримтаар. Өгөгдөл бага бол үүнийгээ хэл.",
    `3. Слот бүрт: pillar (дээрх нэрсээс яг), format, title (дотоод нэр 3-6 үг), angle (юуны тухай, 1 өгүүлбэр), hook (постын ЭХНИЙ МӨР — яг бичигдэх текст), cta (төгсгөлийн дуудлага), why (яагаад энэ сэдэв энэ өдөр/цагт — өгөгдөлд тулгуурласан 1 өгүүлбэр). ${imageRule}`,
    "Дүрэм: нэг 7 хоногт hook, өнцөг давтахгүй; 7 хоног нэг түүх мэт өрнөнө (эхэндээ сонирхол татах, дунд нь гүнзгийрүүлэх, төгсгөлд нь урих); товлогдсон постуудын сэдвийг давтахгүй.",
    "",
    `JSON: {"theme":"","goal":"","summary":"","learned":["","",""],"pillars":[{"name":"","share":0,"why":"энэ 7 хоногт яагаад ийм хувь"}],"slots":[{"n":1,"pillar":"","format":"text","title":"","angle":"","hook":"","cta":"","why":""}]}`,
  ].filter((x) => x !== "").join("\n");
  const r = await llm(system, user, { maxTokens: 7000, reasoning: "low", temperature: 0.7 });
  type PJ = { theme?: string; goal?: string; summary?: string; learned?: string[]; pillars?: { name?: string; share?: number; why?: string }[]; slots?: { n?: number; pillar?: string; format?: string; title?: string; angle?: string; hook?: string; cta?: string; why?: string }[] };
  const j = parseJson<PJ>(r.text);
  const names = pillars.map((p) => p.name);
  const slots: IPlanSlot[] = times.map((at, i) => {
    const x = (j.slots || []).find((s) => Number(s.n) === i + 1) || (j.slots || [])[i] || {};
    const format: "text" | "image" = b.imageMode !== "off" && x.format === "image" ? "image" : "text";
    return {
      id: randomBytes(5).toString("hex"), at, format,
      platforms: b.channels.filter((c) => format === "image" || c !== "instagram"),
      pillar: names.includes(String(x.pillar)) ? String(x.pillar) : names[i % Math.max(1, names.length)] || "Ерөнхий",
      title: String(x.title || "").slice(0, 120), angle: String(x.angle || "").slice(0, 400), hook: String(x.hook || "").slice(0, 300),
      cta: String(x.cta || "").slice(0, 200), why: String(x.why || "").slice(0, 400),
      caption: "", alt: "", imagePrompt: "", imageUrl: "", imageState: format === "image" && b.imageMode === "auto" ? "queued" : "none", imageError: "",
      score: 0, scoreWhy: "", status: "queued", error: "", instruction: "", history: [], imageHistory: [], socialPostId: "", results: [],
      metrics: { likes: 0, comments: 0, shares: 0, views: 0, score: 0, syncedAt: null }, edited: false, approvedAt: null,
    };
  });
  const prevScore = (ctx.prev?.slots || []).filter((s) => s.status === "published").reduce((a, s) => a + (s.metrics?.score || 0), 0);
  await ContentPlan.updateOne({ _id: plan._id }, { $set: {
    status: "writing", aiModel: r.model, slots,
    strategy: {
      theme: String(j.theme || "").slice(0, 120), goal: String(j.goal || "").slice(0, 300), summary: String(j.summary || "").slice(0, 600),
      learned: (j.learned || []).map(String).filter(Boolean).slice(0, 4),
      pillars: (j.pillars?.length ? j.pillars : pillars).map((p) => ({ name: String(p.name || ""), share: Math.round(Number(p.share) || pillars.find((x) => x.name === p.name)?.share || 0), why: String((p as { why?: string }).why || "") })).filter((p) => p.name),
    },
    context: {
      posts7d: ctx.recent.length, avg7d: ctx.recent.length ? Math.round((ctx.recent.reduce((a, x) => a + x.score, 0) / ctx.recent.length) * 10) / 10 : 0,
      bestDay: st?.bestDay || "", bestHour: st?.bestHour || "", bestFormat: st?.bestFormat || "", external: ctx.external.length, prevScore,
    },
  } });
  await log(plan._id, "Стратеги", true, `${slots.length} слот · ${j.theme || ""} · ${r.model}`);
}

async function doWrite(plan: PlanL, slot: IPlanSlot, b: BrandL) {
  await setSlot(plan._id, slot.id, { status: "writing", error: "" }, { status: "queued" });
  try {
    const ctx = b.kind === "personal" ? await buildContext(b, plan.weekStart, []) : null;
    const pb = ctx?.playbook;
    const hint = b.pillars.find((p) => p.name === slot.pillar)?.hint || "";
    const others = plan.slots.filter((s) => s.id !== slot.id).map((s) => `· ${s.hook || s.title}`).join("\n");
    const threads = slot.platforms.includes("threads");
    const system = `Чи ${b.name}-ийн нэрээр, ЯГ түүний дуу хоолойгоор Монгол хэлээр сошиал пост бичдэг. Зохиомол тоо, хүн, түүх, сэтгэгдэл БҮҮ бич — бодит туршлага шиг сонсогдох ёстой ч худал баримт оруулахгүй. Зөвхөн JSON буцаа.\n${await voiceBlock(b)}`;
    const user = [
      pb?.summary ? `PLAYBOOK: ${pb.summary}\nХИЙХ: ${(pb.doList || []).join("; ")}\nБҮҮ ХИЙ: ${(pb.avoid || []).join("; ")}` : "",
      ctx?.top.length ? `ШИЛДЭГ ПОСТУУД (хэлбэр, урт, эхлэлийг нь дуурай; сэдвийг нь биш):\n${ctx.top.slice(0, 4).map(line).join("\n\n")}` : "",
      ctx?.low.length ? `СУЛ ПОСТУУД (эдний алдааг давтахгүй):\n${ctx.low.slice(0, 2).map(line).join("\n\n")}` : "",
      `7 ХОНОГИЙН СЭДЭВ: ${plan.strategy.theme} — ${plan.strategy.goal}`,
      others ? `ЭНЭ 7 ХОНОГИЙН БУСАД ПОСТУУДЫН HOOK (давтахгүй):\n${others}` : "",
      "",
      `ЭНЭ ПОСТ: ${WEEKDAYS[ub(slot.at).wd]} ${md(slot.at)} ${hm(slot.at)} · багана «${slot.pillar}» (${hint}) · ${slot.format === "image" ? "ЗУРАГТАЙ пост" : "ТЕКСТ пост"} · сувгууд: ${slot.platforms.join(", ") || "тодорхойгүй"}`,
      `ГАРЧИГ: ${slot.title}\nӨНЦӨГ: ${slot.angle}\nHOOK САНАА: ${slot.hook}\nCTA: ${slot.cta}`,
      slot.instruction ? `\nЗАСВАРЛАХ ЗААВАР (заавал биелүүл): ${slot.instruction}\nӨМНӨХ ХУВИЛБАР:\n${slot.caption}` : "",
      "",
      `УРТ: ${threads ? "150–450 тэмдэгт (Threads-ийн хязгаар 500 — хэтрүүлж БОЛОХГҮЙ)" : "200–900 тэмдэгт"}. Энэ бол ДООД хязгаар ч мөн — хэт богино хэсэгчилсэн текст бичихгүй.`,
      `JSON: {"caption":"бүтэн пост","alt":"өөр hook-той, өөр өнцгөөс 2 дахь хувилбар (ижил урттай)",${slot.format === "image" ? `"imagePrompt":"ENGLISH. One concrete photographic scene for this post (subject, setting, light, camera angle). No text, letters or logos in the image.",` : ""}"score":0,"scoreWhy":"энэ пост яагаад ажиллах/ажиллахгүй байж болох — 1 өгүүлбэр, шилдэг постуудтай харьцуулж"}`,
    ].filter(Boolean).join("\n");
    const r = await llm(system, user, { maxTokens: 2400, reasoning: "none", temperature: 0.85 });
    const j = parseJson<{ caption?: string; alt?: string; imagePrompt?: string; score?: number; scoreWhy?: string }>(r.text);
    const caption = String(j.caption || "").trim();
    if (!caption) throw new Error("Хоосон ноорог ирлээ");
    await setSlot(plan._id, slot.id, {
      status: "draft", caption, alt: String(j.alt || "").trim(), imagePrompt: String(j.imagePrompt || slot.imagePrompt || "").trim(),
      score: Math.max(1, Math.min(100, Math.round(Number(j.score) || 50))), scoreWhy: String(j.scoreWhy || ""), instruction: "", error: "",
    }, { status: "writing" });
    await log(plan._id, "Ноорог", true, `${WEEKDAYS[ub(slot.at).wd]} ${hm(slot.at)} · ${slot.pillar} · ${Array.from(caption).length} тэмдэгт`);
  } catch (e) {
    const msg = (e as Error).message;
    await setSlot(plan._id, slot.id, { status: slot.caption ? "draft" : "error", error: msg, instruction: "" }, { status: "writing" });
    await log(plan._id, "Ноорог", false, `${slot.title}: ${msg}`);
  }
}

let adminIdCache: unknown = null;
async function adminUserId() {
  if (adminIdCache) return adminIdCache;
  const u = await User.findOne({ email: SUPER_ADMIN_EMAILS[0] }).select("_id").lean<{ _id: unknown }>();
  adminIdCache = u?._id || null;
  return adminIdCache;
}
async function refImage(u: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const local = u.replace(/^https?:\/\/[^/]*antaqor\.com/, "");
    const buf = local.startsWith("/uploads/") ? await readFile(path.join(process.cwd(), "public", local)) : Buffer.from(await (await fetch(u, { signal: AbortSignal.timeout(15000) })).arrayBuffer());
    const jpg = await sharp(buf).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    return { mimeType: "image/jpeg", data: jpg.toString("base64") };
  } catch { return null; }
}
async function doImage(plan: PlanL, slot: IPlanSlot, b: BrandL) {
  await setSlot(plan._id, slot.id, { imageState: "working", imageError: "" }, { imageState: "queued" });
  const t0 = Date.now();
  const prompt = `${slot.imagePrompt || `${slot.title}. ${slot.angle}`}\n\nVisual style: ${b.visualStyle || "clean, modern, premium social media photography"}.\nComposition for a 4:5 social media feed post. Absolutely no text, letters, numbers, captions, logos or watermarks anywhere in the image.`;
  try {
    const refs = b.kind === "product" ? (await Promise.all((b.product.refImages || []).slice(0, 3).map(refImage))).filter((x): x is { mimeType: string; data: string } => !!x) : [];
    const r = await generateNanoBanana({ modelId: "nano2", prompt, refImages: refs, aspectRatio: "4:5", size: "1K" });
    const out = await sharp(r.buf).rotate().resize(1440, 1800, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#0A0A0A" }).jpeg({ quality: 88, chromaSubsampling: "4:2:0" }).toBuffer();
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `agent-${randomUUID()}.jpg`;
    await writeFile(path.join(UPLOAD_DIR, filename), out);
    const url = `/uploads/${filename}`;
    const set: Record<string, unknown> = { imageState: "done", imageUrl: url, imageError: "" };
    if (b.channels.includes("instagram") && !slot.platforms.includes("instagram")) set.platforms = [...slot.platforms, "instagram"];
    await setSlot(plan._id, slot.id, set, {}, { $inc: { usd: r.usd || 0 } });
    if (slot.imageUrl) await setSlot(plan._id, slot.id, {}, {}, { $push: { "slots.$[s].imageHistory": { $each: [slot.imageUrl], $slice: -6 } } });
    const uid = await adminUserId();
    if (uid) await AiImage.create({ user: uid, prompt: `[Контент агент] ${slot.title}`, fullPrompt: prompt, modelId: "nano2", modelVersion: r.modelVersion, provider: "gemini",
      aspectRatio: "4:5", resolution: "standard", style: "agent", refCount: refs.length, url, mime: "image/jpeg", bytes: out.length, status: "done", error: "",
      durationMs: Date.now() - t0, cost: 0, refunded: false, usd: r.usd, usdEstimate: r.usdEstimate, tokens: { prompt: 0, image: 0, total: 0 } }).catch(() => {});
    await log(plan._id, "Зураг", true, `${slot.title} · $${(r.usd || 0).toFixed(3)}`);
  } catch (e) {
    const raw = (e as Error).message || "";
    const msg = /prepayment credits|billing|quota|exhausted|\b(402|429)\b/i.test(raw)
      ? "Google AI Studio-ийн кредит дууссан — цэнэглэсний дараа «Дахин үүсгэх» дарна уу, эсвэл өөрийн зургаа оруулна уу"
      : raw || "Зураг үүсгэж чадсангүй";
    /* Зураггүй бол Instagram явахгүй — сувгаас хасаж, текст пост болгон үлдээнэ */
    await setSlot(plan._id, slot.id, { imageState: "error", imageError: msg.slice(0, 300), platforms: slot.imageUrl ? slot.platforms : slot.platforms.filter((p) => p !== "instagram") });
    await log(plan._id, "Зураг", false, `${slot.title}: ${msg}`);
  }
}

async function notifyReady(plan: PlanL, b: BrandL) {
  const uid = await adminUserId();
  if (uid) {
    const n = (await ContentPlan.findById(plan._id).select("slots.status").lean<{ slots: { status: string }[] }>())?.slots.filter((s) => s.status === "draft").length || 0;
    await Notification.create({ recipient: uid, type: "system", title: `Контент агент · ${b.name}`, message: `${weekLabel(plan.weekStart)} — ${n} ноорог батлахыг хүлээж байна`, link: `/admin/content-agent?brand=${b.key}` }).catch(() => {});
  }
  await ContentPlan.updateOne({ _id: plan._id }, { $set: { notified: true } });
}

/* ─── Төлөвлөгөө үүсгэх / 7 хоногийн хуваарь ─────────────────────────── */
export async function createPlan(brandKey: string, weekStart: Date, note: string, by: string, replace: boolean) {
  await dbConnect();
  const ws = weekStartOf(weekStart);
  if (ws.getTime() + 7 * DAY < Date.now()) throw new Error("Өнгөрсөн 7 хоногт төлөвлөгөө гаргах боломжгүй");
  const b = await AgentBrand.findOne({ key: brandKey }).lean<BrandL>();
  if (!b) throw new Error("Брэнд олдсонгүй");
  const existing = await ContentPlan.findOne({ brand: brandKey, weekStart: ws, active: true }).lean<PlanL>();
  if (existing) {
    if (!replace) throw new Error("Энэ 7 хоногт төлөвлөгөө аль хэдийн байна");
    if (["planning", "writing"].includes(existing.status) && existing.lockedUntil && new Date(existing.lockedUntil) > new Date()) throw new Error("Агент одоо ажиллаж байна — дуусахыг хүлээнэ үү");
    await ContentPlan.updateOne({ _id: existing._id }, { $set: { active: false, status: "archived" } });
  }
  const doc = await ContentPlan.create({ brand: brandKey, weekStart: ws, note: note.slice(0, 600), status: "planning", createdBy: by });
  await log(doc._id, "Эхэлсэн", true, by === "cron" ? "Автомат (долоо хоног бүр)" : `Гараар · ${by}`);
  kick(doc._id);
  return doc;
}

/** cron: идэвхтэй брэнд бүрийн долоо хоногийн ажил + тасарсан ажлыг үргэлжлүүлэх */
export async function weeklyTick(now = new Date()) {
  await ensureBrands();
  const out: Record<string, string>[] = [];
  for (const b of await AgentBrand.find({ active: true }).lean<BrandL[]>()) {
    const runAt = new Date(weekStartOf(now).getTime() + (b.runWeekday - 1) * DAY + b.runHour * 3600e3);
    if (now < runAt || (b.lastRunAt && new Date(b.lastRunAt) >= runAt)) continue;
    await AgentBrand.updateOne({ key: b.key }, { $set: { lastRunAt: now } });
    if (!readiness(b).ok) { out.push({ brand: b.key, skipped: "бэлэн биш" }); continue; }
    const target = weekStartOf(new Date(now.getTime() + DAY));
    if (await ContentPlan.exists({ brand: b.key, weekStart: target, active: true })) { out.push({ brand: b.key, skipped: "төлөвлөгөө байна" }); continue; }
    try { const p = await createPlan(b.key, target, "", "cron", false); out.push({ brand: b.key, plan: String(p._id) }); }
    catch (e) { out.push({ brand: b.key, error: (e as Error).message }); }
  }
  const stuck = await ContentPlan.find({ status: { $in: ["planning", "writing"] }, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] }).select("_id").lean();
  stuck.forEach((s) => kick(s._id));
  return { ran: out, resumed: stuck.length };
}

/* ─── Батлах / цуцлах / засах ──────────────────────────────────────────── */
async function load(planId: string, slotId: string) {
  await dbConnect();
  const plan = await ContentPlan.findOne({ _id: planId, active: true }).lean<PlanL>();
  if (!plan) throw new Error("Төлөвлөгөө олдсонгүй");
  const slot = plan.slots.find((s) => s.id === slotId);
  if (!slot) throw new Error("Слот олдсонгүй");
  const brand = await AgentBrand.findOne({ key: plan.brand }).lean<BrandL>();
  if (!brand) throw new Error("Брэнд олдсонгүй");
  return { plan, slot, brand };
}
function postInput(slot: Pick<IPlanSlot, "caption" | "imageUrl" | "platforms">) {
  return { text: slot.caption.trim(), imageUrl: slot.imageUrl ? abs(slot.imageUrl) : undefined, platforms: slot.platforms as SocialPlatform[], overrides: {} };
}
function assertPublishable(slot: Pick<IPlanSlot, "caption" | "imageUrl" | "platforms" | "at" | "format" | "imageState">, brand: BrandL) {
  const errs = checkSlot(slot, brand).filter((c) => c.level === "error").map((c) => c.label);
  const v = validate(postInput(slot));
  if (slot.platforms.some((p) => p !== "threads") && !brand.metaAccount) v.push("Facebook / Instagram аккаунт тохируулаагүй (Тохиргоо → Сувгууд)");
  if (slot.platforms.includes("threads") && !brand.threadsUserId) v.push("Threads аккаунт тохируулаагүй (Тохиргоо → Сувгууд)");
  const all = Array.from(new Set([...errs, ...v]));
  if (all.length) throw new Error(all.join(" · "));
  scheduleDate(new Date(slot.at).toISOString());
}

export async function approveSlot(planId: string, slotId: string, email: string) {
  const { plan, slot, brand } = await load(planId, slotId);
  if (slot.status !== "draft") throw new Error("Зөвхөн ноорог батлагдана");
  assertPublishable(slot, brand);
  const doc = await SocialPost.create({
    ...postInput(slot), imageUrl: slot.imageUrl ? abs(slot.imageUrl) : "", videoUrl: "",
    brief: `[КОНТЕНТ АГЕНТ · ${brand.name} · ${isoWeek(plan.weekStart)}-р 7 хоног] ${slot.pillar} · ${slot.title}`.slice(0, 3000),
    metaAccount: slot.platforms.some((p) => p !== "threads") ? brand.metaAccount : "", threadsUserId: slot.platforms.includes("threads") ? brand.threadsUserId : "",
    threads: { linkUrl: "", replyControl: "", topicTag: "" }, results: [], state: "scheduled", scheduledAt: new Date(slot.at),
    requestKey: randomUUID(), createdByEmail: email, lastError: "",
  });
  const r = await setSlot(plan._id, slot.id, { status: "scheduled", socialPostId: String(doc._id), approvedAt: new Date(), error: "" }, { status: "draft" });
  if (!r.modifiedCount) { await SocialPost.deleteOne({ _id: doc._id, state: "scheduled" }); throw new Error("Слот өөрчлөгдсөн байна — дахин ачаалаад оролдоно уу"); }
}

export async function unapproveSlot(planId: string, slotId: string) {
  const { plan, slot } = await load(planId, slotId);
  if (slot.status !== "scheduled") throw new Error("Товлогдоогүй байна");
  if (slot.socialPostId) {
    const gone = await SocialPost.findOneAndDelete({ _id: slot.socialPostId, state: "scheduled" });
    if (!gone && (await SocialPost.exists({ _id: slot.socialPostId }))) throw new Error("Нийтэлж эхэлсэн тул цуцлах боломжгүй");
  }
  await setSlot(plan._id, slot.id, { status: "draft", socialPostId: "", approvedAt: null }, { status: "scheduled" });
}

export async function approveAll(planId: string, email: string) {
  await dbConnect();
  const plan = await ContentPlan.findOne({ _id: planId, active: true }).lean<PlanL>();
  if (!plan) throw new Error("Төлөвлөгөө олдсонгүй");
  const ok: string[] = [], failed: { id: string; error: string }[] = [];
  for (const s of plan.slots.filter((x) => x.status === "draft")) {
    try { await approveSlot(planId, s.id, email); ok.push(s.id); } catch (e) { failed.push({ id: s.id, error: (e as Error).message }); }
  }
  return { approved: ok, failed };
}

export type SlotEdit = { caption?: string; alt?: string; at?: string; platforms?: string[]; imageUrl?: string; title?: string };
export async function editSlot(planId: string, slotId: string, e: SlotEdit) {
  const { plan, slot, brand } = await load(planId, slotId);
  if (!["draft", "scheduled", "error", "skipped"].includes(slot.status)) throw new Error("Энэ төлөвт засах боломжгүй");
  const next = { ...slot };
  if (typeof e.caption === "string") next.caption = e.caption.slice(0, 5000);
  if (typeof e.alt === "string") next.alt = e.alt.slice(0, 5000);
  if (typeof e.title === "string") next.title = e.title.slice(0, 120);
  if (typeof e.at === "string") { const d = new Date(e.at); if (!Number.isFinite(d.getTime())) throw new Error("Цаг буруу"); next.at = d; }
  if (Array.isArray(e.platforms)) next.platforms = e.platforms.filter((p) => brand.channels.includes(p));
  if (typeof e.imageUrl === "string") {
    const u = e.imageUrl.trim();
    if (u && !/^(\/uploads\/|https:\/\/(www\.)?antaqor\.com\/uploads\/)/.test(u)) throw new Error("Зураг antaqor.com/uploads дээр байх ёстой");
    next.imageUrl = u.replace(/^https:\/\/(www\.)?antaqor\.com/, "");
    next.imageState = u ? "done" : "none";
    if (!u) next.platforms = next.platforms.filter((p) => p !== "instagram");
    next.format = u ? "image" : next.format === "image" ? "text" : next.format;
  }
  if (slot.status === "scheduled") {
    assertPublishable(next, brand);
    const r = await SocialPost.updateOne({ _id: slot.socialPostId, state: "scheduled" }, { $set: {
      text: next.caption.trim(), imageUrl: next.imageUrl ? abs(next.imageUrl) : "", platforms: next.platforms, scheduledAt: new Date(next.at),
      metaAccount: next.platforms.some((p) => p !== "threads") ? brand.metaAccount : "", threadsUserId: next.platforms.includes("threads") ? brand.threadsUserId : "",
    } });
    if (!r.matchedCount) throw new Error("Нийтэлж эхэлсэн тул засах боломжгүй");
  }
  const changedCaption = next.caption !== slot.caption;
  await setSlot(plan._id, slot.id, {
    caption: next.caption, alt: next.alt, title: next.title, at: next.at, platforms: next.platforms, imageUrl: next.imageUrl, imageState: next.imageState, format: next.format,
    edited: slot.edited || changedCaption, status: slot.status === "error" && next.caption.trim() ? "draft" : slot.status, error: slot.status === "error" && next.caption.trim() ? "" : slot.error,
  }, { status: slot.status }, changedCaption && slot.caption ? { $push: { "slots.$[s].history": { $each: [{ caption: slot.caption, note: "Гараар засахын өмнө", at: new Date() }], $slice: -8 } } } : {});
}

export async function rewriteSlot(planId: string, slotId: string, instruction: string) {
  const { plan, slot } = await load(planId, slotId);
  if (!["draft", "error", "skipped"].includes(slot.status)) throw new Error(slot.status === "scheduled" ? "Эхлээд товлолтыг цуцална уу" : "Энэ төлөвт дахин бичих боломжгүй");
  await setSlot(plan._id, slot.id, { status: "queued", instruction: instruction.slice(0, 400), error: "" }, { status: slot.status },
    slot.caption ? { $push: { "slots.$[s].history": { $each: [{ caption: slot.caption, note: instruction ? `«${instruction.slice(0, 60)}» заавраас өмнө` : "Дахин бичихийн өмнө", at: new Date() }], $slice: -8 } } } : {});
  await ContentPlan.updateOne({ _id: plan._id, status: { $in: ["ready", "failed"] } }, { $set: { status: "writing" } });
  kick(plan._id);
}

export async function regenImage(planId: string, slotId: string, prompt?: string) {
  const { plan, slot, brand } = await load(planId, slotId);
  if (slot.status === "scheduled") throw new Error("Эхлээд товлолтыг цуцална уу");
  if (!["draft", "error", "skipped"].includes(slot.status)) throw new Error("Ноорог бэлэн болсны дараа зураг үүсгэнэ");
  if (brand.imageMode === "off") throw new Error("Зураг унтраалттай (Тохиргоо → Зураг)");
  await setSlot(plan._id, slot.id, { imageState: "queued", imageError: "", format: "image", ...(prompt?.trim() ? { imagePrompt: prompt.trim().slice(0, 1500) } : {}) });
  await ContentPlan.updateOne({ _id: plan._id, status: { $in: ["ready", "failed"] } }, { $set: { status: "writing" } });
  kick(plan._id);
}

export async function skipSlot(planId: string, slotId: string, skip: boolean) {
  const { plan, slot } = await load(planId, slotId);
  if (skip) {
    if (slot.status === "scheduled") await unapproveSlot(planId, slotId);
    else if (!["draft", "error"].includes(slot.status)) throw new Error("Энэ төлөвт алгасах боломжгүй");
    await setSlot(plan._id, slot.id, { status: "skipped" });
  } else {
    if (slot.status !== "skipped") throw new Error("Алгасаагүй байна");
    await setSlot(plan._id, slot.id, { status: slot.caption ? "draft" : "queued" }, { status: "skipped" });
    if (!slot.caption) { await ContentPlan.updateOne({ _id: plan._id, status: "ready" }, { $set: { status: "writing" } }); kick(plan._id); }
  }
}

/* ─── Нийтлэлийн төлөв + хэмжүүр ────────────────────────────────────────── */
const PREFIX: Record<string, string> = { facebook: "fb_", instagram: "ig_", threads: "th_" };
export async function syncPlan(planId: unknown) {
  const plan = await ContentPlan.findById(planId).lean<PlanL>();
  if (!plan) return;
  const linked = plan.slots.filter((s) => s.socialPostId && ["scheduled", "publishing", "published", "failed"].includes(s.status));
  if (!linked.length) return;
  const posts = await SocialPost.find({ _id: { $in: linked.map((s) => s.socialPostId) } }).lean();
  const byId = new Map(posts.map((p) => [String(p._id), p]));
  const ext = posts.flatMap((p) => p.results.filter((r) => r.status === "ok" && r.externalId).map((r) => `${PREFIX[r.platform] || ""}${r.externalId}`));
  const ins = ext.length ? await SocialInsight.find({ externalId: { $in: ext } }).lean() : [];
  const insMap = new Map(ins.map((i) => [i.externalId, i]));
  for (const s of linked) {
    const p = byId.get(s.socialPostId);
    const set: Record<string, unknown> = {};
    if (!p) { if (s.status === "scheduled") Object.assign(set, { status: "draft", socialPostId: "" }); }
    else {
      const st = p.state === "draft" ? "draft" : p.state;
      if (st !== s.status) set.status = st;
      if (st === "draft") set.socialPostId = "";
      if (st === "failed") set.error = p.lastError || "Нийтлэхэд алдаа";
      const results = p.results.map((r) => ({ platform: r.platform, status: r.status, permalink: r.permalink || "", externalId: r.externalId || "" }));
      if (JSON.stringify(results) !== JSON.stringify(s.results || [])) set.results = results;
      if (st === "published") {
        const m = { likes: 0, comments: 0, shares: 0, views: 0, score: 0 };
        for (const r of p.results) { const i = insMap.get(`${PREFIX[r.platform] || ""}${r.externalId}`); if (i) { m.likes += i.likes; m.comments += i.comments; m.shares += i.shares; m.views += i.views || 0; m.score += i.score; } }
        if (m.score !== s.metrics?.score || m.views !== s.metrics?.views || m.likes !== s.metrics?.likes) set.metrics = { ...m, syncedAt: new Date() };
      }
    }
    if (Object.keys(set).length) await setSlot(plan._id, s.id, set);
  }
}
