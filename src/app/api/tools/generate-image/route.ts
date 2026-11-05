import { refLimit } from "@/lib/imagePricing";
import { IMAGE_FULL_PROMPT_LIMIT, imagePromptLimit, imagePromptError } from "@/lib/imagePrompt";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { buildFinalPrompt, findStyle, findAspect } from "@/lib/imageGen";
import { generateNanoBanana, NanoBananaError, geminiImageKey } from "@/lib/nanoBanana";
import { findImageModel, creditCost, flatUsd, type ImageModelId } from "@/lib/imagePricing";
import { loadImagePricing } from "@/lib/imagePricingServer";
import dbConnect from "@/lib/mongodb";
import AiImage from "@/models/AiImage";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// ─── AI image studio — POST /api/tools/generate-image ──────────────────────
//
// Flow: auth → burst limit → parse → price (SiteSettings) → CHARGE credits →
// provider call → save file → write AiImage history row → respond.
// On provider failure: REFUND + write a failed history row (refunded:true)
// so admin spend reports reconcile with CreditTx to the credit.
//
// Nano Banana 2 / Pro / Lite go through src/lib/nanoBanana.ts (dedicated
// GEMINI_IMAGE_API_KEY, model fallbacks, usage-token USD accounting).

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const REASON = "AI_IMAGE_GEN";

const COMING_SOON = new Set(["seeddream", "seeddance", "grok"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // Burst rate limit
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

  // ── Parse body ────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const promptRaw = String((body as { prompt?: unknown }).prompt || "").trim();
  const styleId = String((body as { style?: unknown }).style || "auto");
  const aspectId = String((body as { aspectRatio?: unknown }).aspectRatio || "1:1");
  const rawModel = String((body as { model?: unknown }).model || "nano2");
  const rawRes = String((body as { resolution?: unknown }).resolution || "standard");
  let resolution: "standard" | "hd" = rawRes === "hd" ? "hd" : "standard";
  if (COMING_SOON.has(rawModel)) {
    return NextResponse.json({ error: "Энэ модель удахгүй гарна" }, { status: 501 });
  }
  const modelDef = findImageModel(rawModel) || findImageModel("nano2")!;
  const modelChoice = modelDef.id as ImageModelId;
  // Gemini models without imageSize support (Lite, 2.5) are 1K-only: never
  // charge the HD multiplier for a resolution the provider cannot deliver.
  if (resolution === "hd" && modelDef.provider === "gemini" && !modelDef.supportsImageSize) resolution = "standard";

  // Accept either `inputImages` (array) or `inputImage` (legacy single).
  const rawList: string[] = Array.isArray((body as { inputImages?: unknown }).inputImages)
    ? ((body as { inputImages?: unknown[] }).inputImages || []).filter((s): s is string => typeof s === "string")
    : [];
  if (rawList.length === 0) {
    const single = String((body as { inputImage?: unknown }).inputImage || "");
    if (single) rawList.push(single);
  }
  const maxRefs = refLimit(rawModel);
  if (rawList.length > maxRefs) {
    return NextResponse.json({ error: `Энэ загвар хамгийн ихдээ ${maxRefs} лавлах зураг авна` }, { status: 400 });
  }
  /* нийт ачаалал — 10 зураг ч браузерт жижигрүүлэгдэж ирдэг тул 24MB хангалттай */
  if (rawList.reduce((a, r) => a + r.length, 0) > 32 * 1024 * 1024) {
    return NextResponse.json({ error: "Зургууд нийлээд хэт том байна" }, { status: 413 });
  }
  const refImages: { mimeType: string; data: string }[] = [];
  for (const raw of rawList) {
    const m = raw.match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Зураг буруу формат" }, { status: 400 });
    const sizeBytes = Math.ceil((m[2].length * 3) / 4);
    if (sizeBytes > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Зураг 8MB-аас бага байх ёстой" }, { status: 400 });
    }
    refImages.push({ mimeType: m[1], data: m[2] });
  }

  const promptValidation = imagePromptError(promptRaw, imagePromptLimit(modelDef.provider));
  if (promptValidation) return NextResponse.json({ error: promptValidation }, { status: 400 });

  // ── Per-provider key check ─────────────────────────────────────────────
  if (modelDef.provider === "gemini" && !geminiImageKey()) {
    return NextResponse.json({ error: "Gemini тохируулаагүй" }, { status: 500 });
  }
  if (modelDef.provider === "openai" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI тохируулаагүй" }, { status: 500 });
  }
  if (modelDef.provider === "kling" && (!process.env.KLING_ACCESS_KEY || !process.env.KLING_SECRET_KEY)) {
    return NextResponse.json({ error: "Kling тохируулаагүй" }, { status: 500 });
  }

  const style = findStyle(styleId);
  const aspect = findAspect(aspectId);
  // Gemini gets the aspect via imageConfig, so the text hint is only needed
  // for providers that can't take it structurally.
  const prompt = modelDef.provider === "gemini"
    ? `${promptRaw}${style.suffix}`
    : buildFinalPrompt(promptRaw, style.id, aspect.id);

  const finalLimit = modelDef.provider === "gemini" ? IMAGE_FULL_PROMPT_LIMIT : imagePromptLimit(modelDef.provider);
  if (prompt.length > finalLimit) {
    return NextResponse.json({ error: "Промпт болон сонгосон стилийн нийт текст хэт урт байна. Текстээ бага зэрэг богиносгох эсвэл Nano Banana сонгоно уу." }, { status: 400 });
  }

  // ── Price (admin-editable) + charge up-front ───────────────────────────
  const pricing = await loadImagePricing();
  const cost = creditCost(pricing, modelChoice, resolution === "hd");

  const charged = await spendCredits({
    userId,
    amount: cost,
    reason: REASON,
    meta: { prompt: promptRaw.slice(0, 200), style: style.id, aspectRatio: aspect.id, model: modelChoice, resolution },
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
  // House accounts return required:0 → nothing was deducted.
  const actuallyCharged = charged.required > 0;

  // ── Dispatch ───────────────────────────────────────────────────────────
  const t0 = Date.now();
  let outBuf: Buffer;
  let outMime: string;
  let modelVersion = "";
  let usd = 0;
  let usdEstimate = true;
  let tokens = { prompt: 0, image: 0, total: 0 };

  try {
    if (modelDef.provider === "openai") {
      ({ outBuf, outMime } = await callOpenAI(prompt, refImages, aspect.id, resolution));
      modelVersion = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
      ({ usd, estimate: usdEstimate } = flatUsd("gpt", resolution === "hd"));
    } else if (modelDef.provider === "kling") {
      ({ outBuf, outMime } = await callKling(prompt, refImages, aspect.id));
      modelVersion = process.env.KLING_IMAGE_MODEL || "kling-v1-5";
      ({ usd, estimate: usdEstimate } = flatUsd("kling", false));
    } else {
      const r = await generateNanoBanana({
        modelId: modelChoice,
        prompt,
        refImages,
        aspectRatio: aspect.id,
        size: resolution === "hd" ? "2K" : "1K",
      });
      outBuf = r.buf;
      outMime = r.mime;
      modelVersion = r.modelVersion;
      usd = r.usd;
      usdEstimate = r.usdEstimate;
      tokens = {
        prompt: r.usage?.promptTokenCount || 0,
        image: r.usage?.candidatesTokensDetails?.find((d) => d.modality === "IMAGE")?.tokenCount || r.usage?.candidatesTokenCount || 0,
        total: r.usage?.totalTokenCount || 0,
      };
    }
  } catch (err) {
    if (actuallyCharged) await refundCredits({ userId, amount: cost, reason: REASON });
    const msg = err instanceof Error ? err.message : "AI алдаа";
    const status = err instanceof NanoBananaError ? (err.status === 400 ? 400 : 502)
      : (err as { status?: number }).status === 400 ? 400 : 502;
    // Failed row keeps the accounting honest: charged, then refunded.
    recordHistory({
      userId, promptRaw, prompt, modelChoice, provider: modelDef.provider, modelVersion,
      aspect: aspect.id, resolution, style: style.id, refCount: refImages.length,
      url: "", mime: "", bytes: 0, status: "failed", error: msg.slice(0, 500),
      durationMs: Date.now() - t0, cost: actuallyCharged ? cost : 0, refunded: actuallyCharged,
      usd: 0, usdEstimate: true, tokens,
    }).catch(() => {});
    return NextResponse.json({ error: msg, balance: actuallyCharged ? charged.balance + cost : charged.balance }, { status });
  }

  // ── Save to disk + history + respond ───────────────────────────────────
  const ext = outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-gen-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);
  const url = `/uploads/${filename}`;

  const row = await recordHistory({
    userId, promptRaw, prompt, modelChoice, provider: modelDef.provider, modelVersion,
    aspect: aspect.id, resolution, style: style.id, refCount: refImages.length,
    url, mime: outMime, bytes: outBuf.length, status: "done", error: "",
    durationMs: Date.now() - t0, cost: actuallyCharged ? cost : 0, refunded: false,
    usd, usdEstimate, tokens,
  }).catch((e) => { console.error("[generate-image] history write failed", e); return null; });

  return NextResponse.json({
    id: row ? String(row._id) : null,
    url,
    cost: actuallyCharged ? cost : 0,
    balance: charged.balance,
    style: style.id,
    aspectRatio: aspect.id,
    model: modelChoice,
    modelVersion,
    resolution,
  });
}

async function recordHistory(a: {
  userId: string; promptRaw: string; prompt: string; modelChoice: string;
  provider: "gemini" | "openai" | "kling"; modelVersion: string; aspect: string;
  resolution: "standard" | "hd"; style: string; refCount: number; url: string; mime: string;
  bytes: number; status: "done" | "failed"; error: string; durationMs: number; cost: number;
  refunded: boolean; usd: number; usdEstimate: boolean; tokens: { prompt: number; image: number; total: number };
}) {
  await dbConnect();
  return AiImage.create({
    user: a.userId,
    prompt: a.promptRaw,
    fullPrompt: a.prompt,
    modelId: a.modelChoice,
    modelVersion: a.modelVersion,
    provider: a.provider,
    aspectRatio: a.aspect,
    resolution: a.resolution,
    style: a.style,
    refCount: a.refCount,
    url: a.url,
    mime: a.mime,
    bytes: a.bytes,
    status: a.status,
    error: a.error,
    durationMs: a.durationMs,
    cost: a.cost,
    refunded: a.refunded,
    usd: a.usd,
    usdEstimate: a.usdEstimate,
    tokens: a.tokens,
  });
}

// ─── OpenAI gpt-image-1 (or whatever OPENAI_IMAGE_MODEL is set to) ─────
async function callOpenAI(
  prompt: string,
  refImages: { mimeType: string; data: string }[],
  aspectId: string,
  resolution: "standard" | "hd" = "standard"
): Promise<{ outBuf: Buffer; outMime: string }> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  /* HD = "medium" (high нь 15₵×1.5-аар алдагдалтай байж болзошгүй). */
  const quality = resolution === "hd" ? "medium" : "low";

  const size =
    aspectId === "9:16" || aspectId === "3:4"
      ? "1024x1536"
      : aspectId === "16:9" || aspectId === "4:3"
      ? "1536x1024"
      : "1024x1024";

  let res: Response;
  if (refImages.length > 0) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("quality", quality);
    form.set("n", "1");
    refImages.forEach((r, i) => {
      const ext = r.mimeType.includes("jpeg") ? "jpg" : r.mimeType.includes("webp") ? "webp" : "png";
      const blob = new Blob([Buffer.from(r.data, "base64")], { type: r.mimeType });
      form.append("image[]", blob, `ref-${i}.${ext}`);
    });
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: prompt, size, quality, n: 1 }),
    });
  }

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("OpenAI gen-image", res.status, t.slice(0, 400));
    let msg = "OpenAI зураг үүсгэхэд алдаа";
    try {
      const parsed = JSON.parse(t);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch { /* keep default */ }
    const e = new Error(msg);
    (e as { status?: number }).status = res.status === 400 ? 400 : 502;
    throw e;
  }

  type OR = { data?: { b64_json?: string; url?: string }[] };
  const data = (await res.json()) as OR;
  const item = data.data?.[0];
  if (!item) throw new Error("OpenAI зураг буцаасангүй");
  if (item.b64_json) return { outBuf: Buffer.from(item.b64_json, "base64"), outMime: "image/png" };
  if (item.url) {
    const dl = await fetch(item.url);
    if (!dl.ok) throw new Error("OpenAI зураг татаж чадсангүй");
    const ab = await dl.arrayBuffer();
    return { outBuf: Buffer.from(ab), outMime: dl.headers.get("content-type") || "image/png" };
  }
  throw new Error("OpenAI зураг хоосон");
}

// ─── Kling AI image (async — submit then poll) ─────────────────────────
async function callKling(
  prompt: string,
  refImages: { mimeType: string; data: string }[],
  aspectId: string,
): Promise<{ outBuf: Buffer; outMime: string }> {
  const ak = process.env.KLING_ACCESS_KEY!;
  const sk = process.env.KLING_SECRET_KEY!;
  const baseUrl = process.env.KLING_BASE_URL || "https://api-singapore.klingai.com";

  const { createHmac } = await import("crypto");
  const b64u = (b: Buffer | string) =>
    (Buffer.isBuffer(b) ? b : Buffer.from(b)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const pay = b64u(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 }));
  const data = `${head}.${pay}`;
  const sig = b64u(createHmac("sha256", sk).update(data).digest());
  const token = `${data}.${sig}`;

  const klingAspect = ["1:1", "16:9", "9:16", "4:3", "3:4"].includes(aspectId) ? aspectId : "1:1";
  const body: Record<string, unknown> = {
    model_name: process.env.KLING_IMAGE_MODEL || "kling-v1-5",
    prompt: prompt,
    n: 1,
    aspect_ratio: klingAspect,
  };
  if (refImages[0]) {
    body.image = refImages[0].data;
    body.image_reference = "subject";
    body.image_fidelity = 0.5;
  }

  const submitRes = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const submit = (await submitRes.json()) as { code: number; message: string; data?: { task_id: string } };
  if (submit.code !== 0 || !submit.data?.task_id) {
    const e = new Error(submit.message || "Kling зураг үүсгэхэд алдаа");
    if (submitRes.status === 400 || submit.code === 1102 || submit.code === 1100) {
      (e as { status?: number }).status = 400;
    }
    throw e;
  }
  const taskId = submit.data.task_id;

  for (let i = 0; i < 28; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(`${baseUrl}/v1/images/generations/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const poll = (await pollRes.json()) as {
      code: number; message: string;
      data?: { task_status: string; task_status_msg?: string; task_result?: { images?: { url: string }[] } };
    };
    if (poll.code !== 0 || !poll.data) continue;
    const t = poll.data;
    if (t.task_status === "succeed") {
      const url = t.task_result?.images?.[0]?.url;
      if (!url) throw new Error("Kling зураг буцаасангүй");
      const dl = await fetch(url);
      if (!dl.ok) throw new Error("Kling зураг татаж чадсангүй");
      const ab = await dl.arrayBuffer();
      return { outBuf: Buffer.from(ab), outMime: dl.headers.get("content-type") || "image/png" };
    }
    if (t.task_status === "failed") {
      const e = new Error(t.task_status_msg || "Kling амжилтгүй");
      (e as { status?: number }).status = 400;
      throw e;
    }
  }
  throw new Error("Kling хугацаа дууссан");
}

export const dynamic = "force-dynamic";
export const maxDuration = 90;
