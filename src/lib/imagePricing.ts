// ─── AI image pricing — ONE catalog for the tool page, the API route and admin ──
//
// Client-safe (no server imports). Two layers of "price":
//   1. CREDIT price the member pays  — defaults here, admin-overridable via
//      SiteSettings (imgCost* keys, see src/lib/siteSettings.ts DEFAULTS).
//   2. USD cost Antaqor pays Google/OpenAI/Kling — computed per generation
//      from the provider's usage metadata (tokens), so the admin dashboard
//      shows real margin, not a guess.
//
// Nano Banana 2 (gemini-3.1-flash-image) returns `usageMetadata` with
// `candidatesTokensDetails[{modality:"IMAGE", tokenCount}]` — a 1K image is
// ~1120 tokens, 2K ~1120 too (billed per image tier), and the list price is
// per 1M output-image tokens. That is what USD_RATES encodes.

export type ImageModelId = "nano2" | "nanoPro" | "nanoLite" | "nano" | "gpt" | "kling";

export interface ImageModelDef {
  id: ImageModelId;
  label: string;
  sub: string;
  provider: "gemini" | "openai" | "kling";
  /** Default credit price (1K). Admin can override via SiteSettings. */
  credits: number;
  /** SiteSettings key holding the override. */
  settingKey: "imgCostNano2" | "imgCostNanoPro" | "imgCostNanoLite" | "imgCostNano" | "imgCostGpt" | "imgCostKling";
  /** Ordered Gemini model candidates (primary first, fallbacks after). */
  geminiModels?: string[];
  /** Supports imageConfig.imageSize (1K/2K). 2.5-flash-image does not. */
  supportsImageSize?: boolean;
  /** HD үнэ (кр) — өгсөн бол ×hdMultiplier-ийн оронд. gpt HD нь 15 дахин үнэтэй. */
  hdCredits?: number;
}

/* 2026-10-18: лавлах зургийн дээд тоо — загвар бүрийн бодит хязгаараас доош.
   Gemini 3 зургийн загварууд 14, gpt-image 16 хүртэл авдаг; 2.5-flash-image
   3-аас олонд чанар унадаг; Kling зөвхөн эхнийхийг уншина. */
export const REF_MAX = 10;
export function refLimit(id: string): number {
  if (id === "kling") return 1;
  if (id === "nano" || id === "nanoLite") return 3;
  return REF_MAX;
}

export const IMAGE_MODELS: ImageModelDef[] = [
  {
    /* 2026-10-13: "nano2" слот = Nano Banana 2.1 (`gemini-nano-banana-2.1`, Google
       ListModels-оор баталгаажсан); унавал Nano Banana 2 руу шилжинэ. */
    id: "nano2", label: "Nano Banana 2.1", sub: "Google · бодит, хурдан", provider: "gemini",
    credits: 400, hdCredits: 600, settingKey: "imgCostNano2",
    geminiModels: ["gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3.1-flash-image-preview"],
    supportsImageSize: true,
  },
  {
    id: "nanoPro", label: "Nano Banana Pro", sub: "Gemini 3 Pro · дээд", provider: "gemini",
    credits: 800, hdCredits: 1200, settingKey: "imgCostNanoPro",
    geminiModels: ["gemini-3-pro-image", "gemini-3-pro-image-preview", "gemini-3.1-flash-image"],
    supportsImageSize: true,
  },
  {
    id: "nanoLite", label: "Nano Banana 2 Lite", sub: "Gemini · хурдан · хямд", provider: "gemini",
    credits: 200, settingKey: "imgCostNanoLite",
    geminiModels: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
    // Measured 2026-09-02: lite returns 400 "Image size 2K is not supported". 1K only.
    supportsImageSize: false,
  },
  {
    id: "nano", label: "Nano Banana", sub: "Gemini 2.5 · legacy", provider: "gemini",
    credits: 400, settingKey: "imgCostNano",
    geminiModels: ["gemini-2.5-flash-image", "gemini-3.1-flash-image"],
    supportsImageSize: false,
  },
  { id: "gpt", label: "ChatGPT Image", sub: "OpenAI · gpt-image-2", provider: "openai", credits: 100, hdCredits: 1000, settingKey: "imgCostGpt" },
  { id: "kling", label: "Kling Image", sub: "Kling AI · эх ref", provider: "kling", credits: 200, settingKey: "imgCostKling" },
];

export const DEFAULT_HD_MULTIPLIER = 1.5;

export function findImageModel(id: string): ImageModelDef | undefined {
  return IMAGE_MODELS.find((m) => m.id === id);
}

/** Shape returned by GET /api/tools/image-pricing and consumed by the page. */
export interface ImagePricing {
  costs: Record<ImageModelId, number>;
  hdMultiplier: number;
  likesPerCredit: number;
  likeMilestoneCredits: number;
}

export function defaultPricing(): ImagePricing {
  const costs = {} as Record<ImageModelId, number>;
  for (const m of IMAGE_MODELS) costs[m.id] = m.credits;
  return { costs, hdMultiplier: DEFAULT_HD_MULTIPLIER, likesPerCredit: 25, likeMilestoneCredits: 1 };
}

export function creditCost(pricing: ImagePricing, modelId: ImageModelId, hd: boolean): number {
  const def = findImageModel(modelId);
  const base = pricing.costs[modelId] ?? def?.credits ?? 4;
  if (hd && def?.hdCredits && pricing.costs[modelId] === undefined) return def.hdCredits;
  return Math.max(1, Math.ceil(base * (hd ? pricing.hdMultiplier : 1)));
}

// ─── USD cost (what Antaqor pays) ──────────────────────────────────────────
// Per-1M-token list prices. Verified 2026-09 for the GA models from the
// Gemini pricing page; `estimate: true` marks values not yet confirmed
// against an invoice — the admin dashboard labels those as ≈.
export interface UsdRate { inputPerM: number; imageOutPerM: number; estimate?: boolean }

export const USD_RATES: Record<string, UsdRate> = {
  "gemini-2.5-flash-image":            { inputPerM: 0.30, imageOutPerM: 30 },
  "gemini-3.1-flash-image":            { inputPerM: 0.50, imageOutPerM: 60 },
  "gemini-3.1-flash-image-preview":    { inputPerM: 0.50, imageOutPerM: 60 },
  "gemini-3.1-flash-lite-image":       { inputPerM: 0.25, imageOutPerM: 30, estimate: true },
  "gemini-3-pro-image":                { inputPerM: 2.00, imageOutPerM: 120 },
  "gemini-3-pro-image-preview":        { inputPerM: 2.00, imageOutPerM: 120 },
};

export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  candidatesTokensDetails?: { modality?: string; tokenCount?: number }[];
  promptTokensDetails?: { modality?: string; tokenCount?: number }[];
}

/** USD for one Gemini generation from its usageMetadata. */
export function geminiUsd(modelVersion: string, usage: GeminiUsage | undefined): { usd: number; estimate: boolean } {
  const rate = USD_RATES[modelVersion] || USD_RATES[modelVersion.replace(/-preview$/, "")];
  if (!rate) return { usd: 0, estimate: true };
  const imgTok =
    usage?.candidatesTokensDetails?.find((d) => d.modality === "IMAGE")?.tokenCount ??
    usage?.candidatesTokenCount ?? 0;
  const inTok = usage?.promptTokenCount ?? 0;
  const usd = (imgTok / 1_000_000) * rate.imageOutPerM + (inTok / 1_000_000) * rate.inputPerM;
  return { usd: Math.round(usd * 10_000) / 10_000, estimate: !!rate.estimate };
}

/** Flat estimates for the non-Gemini providers (no token metadata). */
export function flatUsd(modelId: ImageModelId, hd: boolean): { usd: number; estimate: boolean } {
  if (modelId === "gpt") return { usd: hd ? 0.167 : 0.011, estimate: true }; // gpt-image-1 high / low, 1024²
  if (modelId === "kling") return { usd: 0.02, estimate: true };
  return { usd: 0, estimate: true };
}
