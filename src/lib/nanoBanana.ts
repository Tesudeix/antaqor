// ─── Nano Banana (Gemini image) client ─────────────────────────────────────
// Server-only. One function, one job: turn a prompt (+ optional reference
// images) into image bytes via Google's generateContent, with model
// fallbacks, retries, and the usage metadata needed for cost accounting.
//
// Key: GEMINI_IMAGE_API_KEY (dedicated image-gen key, 2026-09-02) falls back
// to GEMINI_API_KEY so the chat key still works if the image key is unset.

import { findImageModel, geminiUsd, type GeminiUsage, type ImageModelId } from "@/lib/imagePricing";

export interface RefImage { mimeType: string; data: string }

export interface NanoBananaResult {
  buf: Buffer;
  mime: string;
  /** Model that actually served the request (after fallback). */
  modelVersion: string;
  usage: GeminiUsage | undefined;
  usd: number;
  usdEstimate: boolean;
  attempts: { model: string; status: number | string }[];
}

export class NanoBananaError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function geminiImageKey(): string | undefined {
  return process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY;
}

const ASPECTS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9", "5:4", "4:5"]);

export async function generateNanoBanana(args: {
  modelId: ImageModelId;
  prompt: string;
  refImages?: RefImage[];
  aspectRatio?: string;
  size?: "1K" | "2K";
}): Promise<NanoBananaResult> {
  const apiKey = geminiImageKey();
  if (!apiKey) throw new NanoBananaError("Gemini тохируулаагүй", 500);

  const def = findImageModel(args.modelId);
  if (!def || def.provider !== "gemini" || !def.geminiModels?.length) {
    throw new NanoBananaError("Буруу модель", 400);
  }

  // Env override for the primary only (fallbacks stay).
  const envPrimary =
    args.modelId === "nanoPro" ? process.env.GEMINI_PRO_IMAGE_MODEL :
    args.modelId === "nano2" ? process.env.GEMINI_IMAGE_MODEL : undefined;
  const candidates = Array.from(new Set([envPrimary, ...def.geminiModels].filter((m): m is string => !!m)));

  const parts: Array<{ inlineData?: RefImage; text?: string }> =
    (args.refImages || []).map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  parts.push({ text: args.prompt });

  const imageConfig: Record<string, string> = {};
  if (args.aspectRatio && ASPECTS.has(args.aspectRatio)) imageConfig.aspectRatio = args.aspectRatio;

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
  type GR = {
    candidates?: { content?: { parts?: Part[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: GeminiUsage;
    modelVersion?: string;
  };

  const attempts: { model: string; status: number | string }[] = [];
  let lastErr: Error | null = null;

  for (const model of candidates) {
    const cfg: Record<string, unknown> = { responseModalities: ["IMAGE"] };
    const ic = { ...imageConfig };
    if (args.size && def.supportsImageSize && !model.startsWith("gemini-2.5")) ic.imageSize = args.size;
    if (Object.keys(ic).length) cfg.imageConfig = ic;
    const body = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: cfg });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const delays = [0, 1500, 4000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
          signal: AbortSignal.timeout(75_000),
        });
      } catch (e) {
        attempts.push({ model, status: "network" });
        lastErr = e instanceof Error ? e : new Error("network");
        if (attempt === delays.length - 1) break;
        continue;
      }
      attempts.push({ model, status: res.status });

      if (res.status === 429 || res.status >= 500) {
        const t = await res.text().catch(() => "");
        console.warn(`[nanoBanana] ${model} attempt ${attempt + 1}: ${res.status} ${t.slice(0, 200)}`);
        lastErr = new Error(`${model} ${res.status}`);
        if (attempt === delays.length - 1) break;
        continue;
      }

      if (res.status === 404) {
        // Model id retired/unavailable for this key — fall through to the next candidate.
        lastErr = new Error(`${model} 404`);
        break;
      }

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("[nanoBanana]", model, res.status, t.slice(0, 400));
        let msg = `Gemini зураг үүсгэхэд алдаа (${res.status})`;
        try {
          const parsed = JSON.parse(t) as { error?: { message?: string } };
          if (parsed.error?.message) msg = parsed.error.message.slice(0, 200);
        } catch { /* keep default */ }
        throw new NanoBananaError(msg, 400);
      }

      const data = (await res.json()) as GR;
      if (data.promptFeedback?.blockReason) {
        throw new NanoBananaError(`AI хүсэлтийг хориглосон: ${data.promptFeedback.blockReason}`, 400);
      }

      const respParts = data.candidates?.[0]?.content?.parts || [];
      const ip = respParts.find((p) => p.inlineData?.data || p.inline_data?.data);
      const b64 = ip?.inlineData?.data || ip?.inline_data?.data;
      const mime = ip?.inlineData?.mimeType || ip?.inline_data?.mime_type || "image/png";
      if (!b64) {
        const fr = data.candidates?.[0]?.finishReason;
        if (fr && /SAFETY|PROHIBITED|IMAGE_SAFETY|RECITATION/i.test(fr)) {
          throw new NanoBananaError(`AI хүсэлтийг хориглосон: ${fr}`, 400);
        }
        console.warn(`[nanoBanana] ${model} returned 200 with no image (${fr || "?"}), trying next`);
        lastErr = new Error("Gemini зураг буцаасангүй");
        break;
      }

      const modelVersion = data.modelVersion || model;
      const { usd, estimate } = geminiUsd(modelVersion, data.usageMetadata);
      if (model !== candidates[0]) console.info(`[nanoBanana] fell back to ${model}`);
      return {
        buf: Buffer.from(b64, "base64"),
        mime,
        modelVersion,
        usage: data.usageMetadata,
        usd,
        usdEstimate: estimate,
        attempts,
      };
    }
  }

  throw new NanoBananaError(
    `AI үйлчилгээ түр ачаалалтай байна. Дахин оролдоорой. (${lastErr?.message || "no models responded"})`,
    502
  );
}
