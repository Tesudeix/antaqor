import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { buildFinalPrompt, findStyle, findAspect } from "@/lib/imageGen";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const REASON = "AI_IMAGE_GEN";
const MAX_PROMPT = 1000;

// Cost per model. New IDs match the client picker.
const COSTS: Record<ModelChoice, number> = {
  nano: 10,
  nano2: 10,
  nanoPro: 15,
  gpt: 15,
  kling: 12,
};

type ModelChoice = "nano" | "nano2" | "nanoPro" | "gpt" | "kling";
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

  // ── Parse body ────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const promptRaw = String((body as { prompt?: unknown }).prompt || "").trim();
  const styleId = String((body as { style?: unknown }).style || "auto");
  const aspectId = String((body as { aspectRatio?: unknown }).aspectRatio || "1:1");
  const rawModel = String((body as { model?: unknown }).model || "nano2");
  const rawRes = String((body as { resolution?: unknown }).resolution || "standard");
  const resolution: "standard" | "hd" = rawRes === "hd" ? "hd" : "standard";
  const resMult = resolution === "hd" ? 1.5 : 1;
  if (COMING_SOON.has(rawModel)) {
    return NextResponse.json({ error: "Энэ модель удахгүй гарна" }, { status: 501 });
  }
  const modelChoice: ModelChoice =
    rawModel === "gpt" ? "gpt" :
    rawModel === "nanoPro" ? "nanoPro" :
    rawModel === "nano2" ? "nano2" :
    rawModel === "kling" ? "kling" :
    "nano";

  // Accept either `inputImages` (new, array) or `inputImage` (legacy single).
  const rawList: string[] = Array.isArray((body as { inputImages?: unknown }).inputImages)
    ? ((body as { inputImages?: unknown[] }).inputImages || []).filter((s): s is string => typeof s === "string")
    : [];
  if (rawList.length === 0) {
    const single = String((body as { inputImage?: unknown }).inputImage || "");
    if (single) rawList.push(single);
  }
  if (rawList.length > 4) {
    return NextResponse.json({ error: "Хамгийн ихдээ 4 зураг" }, { status: 400 });
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
  // First image kept as `refImage` for places that still expect one.
  const refImage = refImages[0] || null;

  if (!promptRaw) return NextResponse.json({ error: "Промпт оруулна уу" }, { status: 400 });
  if (promptRaw.length > MAX_PROMPT) {
    return NextResponse.json({ error: `Промпт ${MAX_PROMPT} тэмдэгтээс бага байх ёстой` }, { status: 400 });
  }

  // ── Per-model upstream key check ───────────────────────────────────────
  const cost = Math.ceil(COSTS[modelChoice] * resMult);
  const isGemini = modelChoice === "nano" || modelChoice === "nano2" || modelChoice === "nanoPro";
  if (isGemini && !process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini тохируулаагүй" }, { status: 500 });
  }
  if (modelChoice === "gpt" && !process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI тохируулаагүй" }, { status: 500 });
  }
  if (modelChoice === "kling" && (!process.env.KLING_ACCESS_KEY || !process.env.KLING_SECRET_KEY)) {
    return NextResponse.json({ error: "Kling тохируулаагүй" }, { status: 500 });
  }

  const style = findStyle(styleId);
  const aspect = findAspect(aspectId);
  const prompt = buildFinalPrompt(promptRaw, style.id, aspect.id);

  // ── Charge credits up-front, refund on upstream failure ────────────────
  const charged = await spendCredits({
    userId,
    amount: cost,
    reason: REASON,
    meta: { prompt: promptRaw.slice(0, 200), style: style.id, aspectRatio: aspect.id, model: modelChoice },
  });
  if (!charged.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй. ${cost} кредит шаардлагатай.`, balance: charged.balance, required: cost },
      { status: 402 }
    );
  }

  // ── Dispatch to the chosen model ───────────────────────────────────────
  let outBuf: Buffer;
  let outMime: string;
  try {
    if (modelChoice === "gpt") {
      ({ outBuf, outMime } = await callOpenAI(prompt, refImages, aspect.id, resolution));
    } else if (modelChoice === "kling") {
      ({ outBuf, outMime } = await callKling(prompt, refImages, aspect.id));
    } else {
      ({ outBuf, outMime } = await callGemini(prompt, refImages, modelChoice === "nanoPro"));
    }
  } catch (err) {
    await refundCredits({ userId, amount: cost, reason: REASON });
    const msg = err instanceof Error ? err.message : "AI алдаа";
    const status = (err as { status?: number }).status === 400 ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  // ── Save to disk + respond ─────────────────────────────────────────────
  const ext = outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-gen-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    cost,
    balance: charged.balance,
    style: style.id,
    aspectRatio: aspect.id,
    model: modelChoice,
  });
}

// ─── Gemini Nano Banana (2 + Pro variants) ─────────────────────────────
async function callGemini(
  prompt: string,
  refImages: { mimeType: string; data: string }[],
  pro: boolean = false
): Promise<{ outBuf: Buffer; outMime: string }> {
  const apiKey = process.env.GEMINI_API_KEY!;
  // Primary model + ordered fallbacks. When the primary returns 503/UNAVAILABLE
  // we try the next one in the list. Real-world: gemini-2.5-flash-image goes
  // capacity-limited at peak hours; the 3.x previews and Imagen pickup slack.
  const primary = pro
    ? (process.env.GEMINI_PRO_IMAGE_MODEL || "gemini-2.5-flash-image")
    : (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image");
  const candidates = Array.from(
    new Set([
      primary,
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ])
  );

  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> =
    refImages.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  parts.push({ text: prompt });
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
  type GR = { candidates?: { content?: { parts?: Part[] } }[]; promptFeedback?: { blockReason?: string } };

  let lastErr: Error | null = null;

  for (const model of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    // Retry the same model 3 times with backoff before giving up on it.
    // Backoff: 0s, 1.5s, 4s. Total worst-case per model ≈ 5.5s wait.
    const delays = [0, 1500, 4000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      // Transient → retry / fallback. 429 (quota) and 5xx fall here.
      if (res.status === 429 || res.status >= 500) {
        const t = await res.text().catch(() => "");
        console.warn(`[gemini] ${model} attempt ${attempt + 1}: ${res.status} ${t.slice(0, 200)}`);
        if (attempt === delays.length - 1) {
          // Exhausted retries on this model — break to try next candidate.
          lastErr = new Error(`${model} ${res.status}`);
          break;
        }
        continue;
      }

      // Hard failure (4xx other than 429) — no point retrying or falling
      // back, the request is malformed. Surface immediately.
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("Gemini gen-image", res.status, t.slice(0, 400));
        const e = new Error(`Gemini зураг үүсгэхэд алдаа (${res.status})`);
        (e as { status?: number }).status = 400;
        throw e;
      }

      const data = (await res.json()) as GR;

      if (data.promptFeedback?.blockReason) {
        const e = new Error(`AI хүсэлтийг хориглосон: ${data.promptFeedback.blockReason}`);
        (e as { status?: number }).status = 400;
        throw e;
      }

      const respParts = data.candidates?.[0]?.content?.parts || [];
      const ip = respParts.find((p) => p.inlineData?.data || p.inline_data?.data);
      const b64 = ip?.inlineData?.data || ip?.inline_data?.data;
      const mime = ip?.inlineData?.mimeType || ip?.inline_data?.mime_type || "image/png";

      if (!b64) {
        // Unusual: 200 with no image (rare safety fallback). Try next model.
        console.warn(`[gemini] ${model} returned 200 with no image, trying next`);
        lastErr = new Error("Gemini зураг буцаасангүй");
        break;
      }
      // Success — log which model carried the request so we can spot fallbacks
      if (model !== primary) console.info(`[gemini] fell back to ${model}`);
      return { outBuf: Buffer.from(b64, "base64"), outMime: mime };
    }
  }

  // All models / retries exhausted. Surface user-facing message that
  // distinguishes capacity issues from misconfiguration.
  throw new Error(
    `AI үйлчилгээ түр ачаалалтай байна. Дахин оролдоорой. (${lastErr?.message || "no models responded"})`
  );
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
  // gpt-image-1 quality flag: low / medium / high. Map UI Standard→low,
  // HD→high. Cost difference is real (~15x on OpenAI) so this matters.
  const quality = resolution === "hd" ? "high" : "low";

  const size =
    aspectId === "9:16" || aspectId === "3:4"
      ? "1024x1536"
      : aspectId === "16:9" || aspectId === "4:3"
      ? "1536x1024"
      : "1024x1024";

  let res: Response;
  if (refImages.length > 0) {
    // Image edit / variation — multipart with one or more images.
    // gpt-image-1 accepts multiple `image[]` fields for multi-reference.
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", prompt.slice(0, 4000));
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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: prompt.slice(0, 4000),
        size,
        quality,
        n: 1,
      }),
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

  if (item.b64_json) {
    return { outBuf: Buffer.from(item.b64_json, "base64"), outMime: "image/png" };
  }
  if (item.url) {
    // gpt-image-1 normally returns b64_json; URL is a fallback.
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
    prompt: prompt.slice(0, 2500),
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
  const submit = (await submitRes.json()) as {
    code: number; message: string; data?: { task_id: string };
  };
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
