import dbConnect from "@/lib/mongodb";
import ContentMetric from "@/models/ContentMetric";
import ContentLoopSettings, { IContentLoopSettings } from "@/models/ContentLoopSettings";
import ContentVariant, { IContentVariant } from "@/models/ContentVariant";
import SocialPost from "@/models/SocialPost";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { VOICE_SPEC, THREADS_MAX_CHARS } from "@/lib/threadsVoice";
import { getBrand, brandPromptBlock } from "@/lib/brandProfile";
import { collectAll } from "@/lib/contentMetrics";
import { publishToAll, type SocialPlatform } from "@/lib/socialPublish";

/* ─── САЙЖРУУЛАХ ДАВТАЛТ ────────────────────────────────────────────────
   20 минут тутам: үзүүлэлт шинэчилнэ → хамгийн сайн явсан постыг олно →
   түүний САНААГ аваад ШИНЭЭР бичнэ → (батлуулаад) нийтэлнэ.

   Яагаад "шинээр" гэж онцолж байна вэ: Meta болон Threads хоёулаа
   ойролцоо давхардсан текстийг барьдаг. "Бага зэрэг сайжруулсан"
   хувилбар нь хамгийн их баригддаг хэлбэр. Тиймээс шинэлэг байдлыг
   ТООЦОЖ хэмжээд, хэт ойрхон бол нийтлэхгүй. */

export async function getSettings(): Promise<IContentLoopSettings> {
  await dbConnect();
  const found = await ContentLoopSettings.findOne({});
  if (found) return found;
  return ContentLoopSettings.create({});
}

/* ─── Шинэлэг байдал ────────────────────────────────────────────────────
   Үгийн багцын Jaccard зөрүү. Төгс бус хэмжүүр ч "ижил постыг дахин
   тавих"-ыг барихад хангалттай бөгөөд ямар ч API шаардахгүй. */
export function novelty(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2),
    );
  const A = norm(a), B = norm(b);
  if (!A.size || !B.size) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union ? 1 - inter / union : 0;
}

const MIN_NOVELTY: Record<string, number> = { light: 0.35, medium: 0.5, rework: 0.62 };

const STRENGTH_BRIEF: Record<string, string> = {
  light: "Ижил санаа, ижил бүтэц. Үг сонголт, өгүүлбэрийн эрэмбийг сайжруул.",
  medium: "Ижил санаа, ӨӨР эхлэл ба өөр жишээ. Бүтцийг нь дахин зохио.",
  rework: "Санааг нь л ав. Огт шинэ эхлэл, шинэ жишээ, шинэ өнцөг. Эх постыг уншсан хүн энэ нь давталт гэж мэдэхгүй байхаар бич.",
};

/* ─── Хувилбар үүсгэх ──────────────────────────────────────────────── */
export async function generateVariant(
  sourceText: string,
  strength: string,
  tries = 2,
): Promise<{ text: string; rationale: string; novelty: number } | null> {
  const brief = STRENGTH_BRIEF[strength] || STRENGTH_BRIEF.rework;
  const need = MIN_NOVELTY[strength] ?? 0.62;

  /* VOICE_SPEC нь ХЭРХЭН бичихийг (хэлбэр, хэл) зааж өгдөг. Брэндийн
     блок нь ЮУНЫ ТӨЛӨӨ бичихийг (байр суурь, үнэт зүйл) нэмнэ. Хоёрыг
     салгасан шалтгаан: хэлбэр нь зөв ч байр суурьгүй пост нь хэнийх ч
     байж болно — тэр нь personal brand биш. */
  const brand = brandPromptBlock(await getBrand());

  const messages = [
    { role: "system" as const, content: VOICE_SPEC + brand },
    {
      role: "user" as const,
      content:
        `Доорх пост сайн ажилласан. Үүний санааг ашиглаж ШИНЭ пост бич.\n\n` +
        `ДААЛГАВАР: ${brief}\n\n` +
        `ХАТУУ ШААРДЛАГА:\n` +
        `- ${THREADS_MAX_CHARS} тэмдэгтээс богино.\n` +
        `- Эх постын өгүүлбэрийг ХУУЛЖ БОЛОХГҮЙ.\n` +
        `- Hashtag бүү хэрэглэ.\n\n` +
        `ЭХ ПОСТ:\n"""${sourceText.slice(0, 1200)}"""\n\n` +
        `Хариултаа ЯГ ийм JSON-оор буцаа, өөр юу ч бүү бич:\n` +
        `{"text":"шинэ постын бүтэн эх бичвэр","rationale":"яагаад ингэж өөрчилснөө нэг өгүүлбэрээр"}`,
    },
  ];

  for (let attempt = 0; attempt < tries; attempt++) {
    for (const p of providers()) {
      let choice;
      try {
        choice = await chatCompletion(p, messages, {
          maxTokens: 1200,
          temperature: 0.95,
          /* Богино зохиолын ажилд далд бодол хэрэггүй — Gemini бол
             сэтгэх загвар тул үүнгүйгээр content хоосон ирж мэднэ. */
          reasoning: "none",
        });
      } catch { continue; }

      const raw = String(choice?.message?.content || "").trim();
      if (!raw) continue;

      const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
      let parsed: { text?: string; rationale?: string };
      try { parsed = JSON.parse(json); } catch { continue; }

      const text = String(parsed.text || "").trim();
      if (!text || text.length > THREADS_MAX_CHARS) continue;

      const nov = novelty(sourceText, text);
      /* Сүүлийн оролдлого дээр хэмжүүрээс арай доош байсан ч буцаана —
         хүн баталгаажуулах тул шийдвэрийг түүнд үлдээнэ. Гэхдээ
         `novelty` тоог нь дагуулж явуулж, дэлгэц дээр анхааруулна. */
      if (nov >= need || attempt === tries - 1) {
        return { text, rationale: String(parsed.rationale || "").slice(0, 300), novelty: nov };
      }
    }
  }
  return null;
}

/* ─── Эх сонгох ────────────────────────────────────────────────────── */
export async function pickSource(s: IContentLoopSettings) {
  const now = Date.now();
  /* Хугацааны цонх: хэтэрхий шинэ пост нь үзүүлэлтээ хурааж амжаагүй,
     хэтэрхий хуучин нь өнөөдрийн байр суурьтай зөрөх эрсдэлтэй. */
  const windowDays = s.sourceWindowDays || 90;
  return ContentMetric.findOne({
    engagement: { $gte: s.minEngagement },
    publishedAt: {
      $lte: new Date(now - s.minAgeHours * 3600_000),
      $gte: new Date(now - windowDays * 86400_000),
    },
    $or: [
      { lastReusedAt: { $exists: false } },
      { lastReusedAt: null },
      { lastReusedAt: { $lte: new Date(now - s.cooldownDays * 86400_000) } },
    ],
  }).sort({ engagement: -1, publishedAt: -1 });
}

/* ─── Нийтлэх ──────────────────────────────────────────────────────── */
export async function publishVariant(v: IContentVariant, byEmail = "loop"): Promise<boolean> {
  const platforms = (v.platforms || []).filter((p) =>
    ["threads", "instagram", "facebook"].includes(p)) as SocialPlatform[];
  if (!platforms.length) {
    v.status = "failed"; v.error = "Суваг сонгогдоогүй"; await v.save();
    return false;
  }

  const post = await SocialPost.create({
    text: v.text,
    platforms,
    state: "publishing",
    brief: "Сайжруулах давталт — эх: " + (v.sourcePermalink || v.sourceExternalId),
    createdByEmail: byEmail,
  });

  const results = await publishToAll({ text: v.text, platforms });
  const ok = results.some((r) => r.status === "ok");

  post.results = results.map((r) => ({
    platform: r.platform, status: r.status, externalId: r.externalId || "",
    permalink: r.permalink || "", error: r.error || "", ms: r.ms, at: new Date(),
  })) as never;
  post.state = ok ? "published" : "failed";
  post.lastError = ok ? "" : results.map((r) => r.error).filter(Boolean).join(" · ").slice(0, 400);
  await post.save();

  v.socialPostId = post._id as never;
  v.status = ok ? "published" : "failed";
  v.error = ok ? "" : post.lastError;
  if (ok) v.publishedAt = new Date();
  await v.save();

  if (ok) {
    /* Эх постыг тэмдэглэнэ — cooldown нь үүн дээр тооцогдоно. */
    await ContentMetric.updateOne(
      { platform: v.sourcePlatform, externalId: v.sourceExternalId },
      { $inc: { reuseCount: 1 }, $set: { lastReusedAt: new Date() } },
    );
    const s = await getSettings();
    s.lastPostAt = new Date();
    await s.save();
  }
  return ok;
}

/* ─── Нэг цохилт ───────────────────────────────────────────────────── */
export interface TickResult {
  ok: boolean;
  note: string;
  collected?: { platform: string; saved: number; error?: string }[];
  variantId?: string;
  published?: boolean;
}

export async function tick(opts: { force?: boolean } = {}): Promise<TickResult> {
  await dbConnect();
  const s = await getSettings();

  /* Үзүүлэлтийг ҮРГЭЛЖ шинэчилнэ — давталт унтраалттай ч тоонууд нь
     дэлгэц дээр амьд байх ёстой. */
  const collected = await collectAll(25);
  s.lastTickAt = new Date();

  const stop = async (note: string): Promise<TickResult> => {
    s.lastNote = note; await s.save();
    return { ok: true, note, collected };
  };

  if (!s.enabled && !opts.force) return stop("Давталт унтраалттай");

  const now = Date.now();
  if (!opts.force && s.lastPostAt && now - s.lastPostAt.getTime() < s.minGapMinutes * 60_000) {
    const left = Math.ceil((s.minGapMinutes * 60_000 - (now - s.lastPostAt.getTime())) / 60_000);
    return stop(`Доод зай хараахан дуусаагүй — ${left} минут үлдлээ`);
  }

  const since = new Date(now - 86400_000);
  const today = await ContentVariant.countDocuments({ status: "published", publishedAt: { $gte: since } });
  if (!opts.force && today >= s.maxPerDay) {
    return stop(`Өдрийн хязгаарт хүрсэн (${today}/${s.maxPerDay})`);
  }

  /* Хүний шийдвэр хүлээж буй хувилбар байвал шинийг үүсгэхгүй —
     эс тэгвээс батлагдаагүй ноорог овоорно. */
  const pending = await ContentVariant.countDocuments({ status: "pending" });
  if (s.requireApproval && pending >= 3) {
    return stop(`${pending} хувилбар шийдвэр хүлээж байна — шинийг үүсгэсэнгүй`);
  }

  const source = await pickSource(s);
  if (!source) return stop("Тохирох эх пост олдсонгүй");

  const gen = await generateVariant(source.text, s.rewriteStrength);
  if (!gen) return stop("AI хувилбар бичиж чадсангүй");

  const variant = await ContentVariant.create({
    sourcePlatform: source.platform,
    sourceExternalId: source.externalId,
    sourceText: source.text,
    sourcePermalink: source.permalink,
    sourceEngagement: source.engagement,
    text: gen.text,
    rationale: gen.rationale,
    novelty: gen.novelty,
    platforms: s.networks,
    status: s.requireApproval ? "pending" : "approved",
  });

  if (s.requireApproval) {
    return {
      ...(await stop("Шинэ хувилбар бэлэн — баталгаажуулалт хүлээж байна")),
      variantId: String(variant._id),
    };
  }

  const ok = await publishVariant(variant);
  const r = await stop(ok ? "Нийтэллээ" : "Нийтэлж чадсангүй: " + variant.error);
  return { ...r, variantId: String(variant._id), published: ok };
}
