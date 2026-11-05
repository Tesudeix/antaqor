import { AI_VIDEO_ENABLED } from "@/lib/flags";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { createVideoTask, higgsfieldConfigured, HiggsfieldError } from "@/lib/higgsfield";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { findVideoModel, resolveRatio, resolveDuration, resolveResolution, videoCreditCost, type VideoModelId } from "@/lib/videoPricing";
import { loadVideoPricing } from "@/lib/videoPricingServer";
import dbConnect from "@/lib/mongodb";
import AiVideo from "@/models/AiVideo";

// ─── AI видео студи — POST /api/tools/generate-video ───────────────────────
//
// Урсгал: нэвтрэлт → хурдны хязгаар → задлан шинжлэх → үнэ (SiteSettings)
// → КРЕДИТ АВАХ → ModelArk даалгавар үүсгэх → "processing" мөр бичих →
// id буцаах. Видео нь ЭНД гарахгүй — `/api/tools/video-status` дуусгана.
//
// Илгээхэд бүтэлгүйтвэл: НЭН ДАРУЙ буцаан олгоод "failed" мөр бичнэ
// (refunded: true), тэгснээр зарлагын тайлан CreditTx-тэй тулна.
//
// Даалгавар үүссэний ДАРААХ бүтэлгүйтэл (ModelArk дотор нь унах) нь
// status маршрутын хариуцлага — тэнд ч мөн буцаан олгоно.

const REASON = "AI_VIDEO_GEN";
const MAX_PROMPT = 2000;
// ModelArk нь зургийг data: URI хэлбэрээр хүлээж авдаг. Хэт томыг
// илгээвэл хүсэлт өөрөө унана — 8MB нь зургийн студийн хязгаартай ижил.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  // Түр хаалттай (src/lib/flags.ts) — кредит хасахаас ӨМНӨ зогсооно.
  if (!AI_VIDEO_ENABLED) {
    return NextResponse.json(
      { error: "AI видео түр хаалттай байна.", code: "DISABLED" },
      { status: 503 }
    );
  }
  const userId = (session.user as { id: string }).id;

  // Хурдны хязгаар — зурагтай ижил хувь хэмжээ. Видео нь илүү үнэтэй тул
  // хэрэв энэ хэтэрхий уужим бол эхлээд ЭНД чангална.
  const burst = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү олон. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
    );
  }
  const daily = rateLimit(`ai-tool:day:${userId}`, LIMITS.AI_TOOL_PER_DAY);
  if (!daily.ok) {
    return NextResponse.json({ error: "Өнөөдрийн хязгаарт хүрлээ. Маргааш дахин үзнэ үү." }, { status: 429 });
  }

  if (!higgsfieldConfigured()) {
    return NextResponse.json(
      { error: "AI видео түр боломжгүй — Higgsfield тохируулаагүй (HF_CREDENTIALS).", code: "NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  // ── Биеийг задлах ──────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const promptRaw = String((body as { prompt?: unknown }).prompt || "").trim();
  const rawModel = String((body as { model?: unknown }).model || "seedance25");
  const rawRatio = String((body as { ratio?: unknown }).ratio || "16:9");
  const rawDuration = Number((body as { duration?: unknown }).duration ?? 5);
  const rawImage = String((body as { image?: unknown }).image || "").trim();
  const rawAudio = (body as { generateAudio?: unknown }).generateAudio;
  const resolution = resolveResolution(String((body as { resolution?: unknown }).resolution || "720p"));

  if (!promptRaw) return NextResponse.json({ error: "Промпт оруулна уу" }, { status: 400 });
  if (promptRaw.length > MAX_PROMPT) {
    return NextResponse.json({ error: `Промпт ${MAX_PROMPT} тэмдэгтээс бага байх ёстой` }, { status: 400 });
  }

  const modelDef = findVideoModel(rawModel) || findVideoModel("seedance25")!;
  const modelChoice = modelDef.id as VideoModelId;
  // Загвар бүр өөр харьцаа/хугацаа дэмждэг. Хүчингүй утгыг ModelArk-д
  // илгээж 400 авахын оронд ЭНД хамгийн ойрын хүчинтэй утганд наана.
  // Эхлэх зурагтай бол `resolveRatio` нь `adaptive` руу шилжинэ —
  // баримтын шаардлага, мөн зургийг тастрахаас сэргийлнэ.
  const duration = resolveDuration(modelDef, rawDuration);

  // ── Дуу ────────────────────────────────────────────────────────────────
  // ModelArk-ийн анхдагч нь `true`. Дэмжихгүй загварт ҮРГЭЛЖ false.
  const generateAudio = modelDef.supportsAudio ? rawAudio !== false : false;

  // ── Эхлэх зураг (сонголт) ──────────────────────────────────────────────
  let promptImage = "";
  if (rawImage) {
    if (!modelDef.supportsImage) {
      return NextResponse.json({ error: `${modelDef.label} эхлэх зураг дэмжихгүй` }, { status: 400 });
    }
    const m = rawImage.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Зураг буруу формат" }, { status: 400 });
    const sizeBytes = Math.ceil((m[2].length * 3) / 4);
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Зураг 8MB-аас бага байх ёстой" }, { status: 400 });
    }
    /* Higgsfield зургийг URL-ээр л авна (base64 биш) — /uploads руу хадгалаад
       нийтэд хүрэх https холбоос өгнө. */
    const ext = m[1].includes("png") ? "png" : m[1].includes("webp") ? "webp" : "jpg";
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const fname = `vidref-${randomUUID()}.${ext}`;
    await writeFile(path.join(dir, fname), Buffer.from(m[2], "base64"));
    const base = (process.env.NEXTAUTH_URL || "https://antaqor.com").replace(/\/$/, "");
    promptImage = `${base}/uploads/${fname}`;
  }
  const ratio = resolveRatio(modelDef, rawRatio, Boolean(promptImage));

  // ── Үнэ (админ засварладаг) + урьдчилж авах ────────────────────────────
  const pricing = await loadVideoPricing();
  const cost = videoCreditCost(pricing, modelChoice, duration, resolution, ratio.wire);

  const charged = await spendCredits({
    userId,
    amount: cost,
    reason: REASON,
    meta: { prompt: promptRaw.slice(0, 200), model: modelChoice, ratio: ratio.id, duration, resolution },
  });
  if (!charged.ok) {
    return NextResponse.json(
      {
        error: `Кредит хүрэлцэхгүй. ${cost} кредит шаардлагатай, танд ${charged.balance} байна.`,
        code: "INSUFFICIENT_CREDITS",
        balance: charged.balance,
        required: cost,
        buyHref: "/credits/buy",
      },
      { status: 402 }
    );
  }
  // Байрны данс (админ) — required:0 буюу юу ч хасагдаагүй.
  const actuallyCharged = charged.required > 0;

  // ── ModelArk руу илгээх ────────────────────────────────────────────────
  let created: { taskId: string };
  try {
    created = await createVideoTask({
      promptText: promptRaw,
      imageUrl: promptImage || undefined,
      ratio: ratio.wire,
      duration,
      resolution,
      generateAudio,
    });
  } catch (err) {
    if (actuallyCharged) await refundCredits({ userId, amount: cost, reason: REASON });
    const msg = err instanceof Error ? err.message : "Higgsfield алдаа";
    const status = err instanceof HiggsfieldError ? err.status : 502;
    await dbConnect()
      .then(() =>
        AiVideo.create({
          user: userId, prompt: promptRaw, modelId: modelChoice, providerModel: modelDef.providerModel,
          mode: promptImage ? "image" : "text", ratio: ratio.id, ratioWire: ratio.wire, duration, generateAudio,
          taskId: "", status: "failed", error: msg.slice(0, 500),
          cost: actuallyCharged ? cost : 0, refunded: actuallyCharged,
        })
      )
      .catch(() => {});
    return NextResponse.json(
      { error: msg, balance: actuallyCharged ? charged.balance + cost : charged.balance },
      { status }
    );
  }

  await dbConnect();
  const row = await AiVideo.create({
    user: userId,
    prompt: promptRaw,
    modelId: modelChoice,
    providerModel: modelDef.providerModel,
    mode: promptImage ? "image" : "text",
    ratio: ratio.id,
    ratioWire: ratio.wire,
    duration,
    generateAudio,
    taskId: created.taskId,
    status: "processing",
    cost: actuallyCharged ? cost : 0,
    /* ModelArk нь даалгавар үүсгэхэд ӨРТГИЙН ТААМАГ БУЦААДАГГҮЙ.
       Жинхэнэ өртөг нь дуусахад `usage.total_tokens` болж ирнэ,
       түүнийг status маршрут `providerTokens` талбарт бичнэ. */
  });

  return NextResponse.json({
    id: String(row._id),
    taskId: created.taskId,
    status: "processing",
    cost: actuallyCharged ? cost : 0,
    balance: charged.balance,
    model: modelChoice,
    ratio: ratio.id,
    duration,
    generateAudio,
  });
}

export const dynamic = "force-dynamic";
