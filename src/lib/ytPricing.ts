import { getSetting } from "@/lib/siteSettings";

/* ─── ТАТАЦЫН КРЕДИТ ҮНЭ ────────────────────────────────────────────────
   Хурц зөрүү: AI зураг (5–15 кредит) нь Antaqor Google-д бодит доллар
   төлдөг тул тийм үнэтэй. Харин энд ТАТАЦ ХЭРЭГЛЭГЧИЙН ӨӨРИЙН МАШИН,
   ӨӨРИЙН ИНТЕРНЭТЭЭР гүйдэг — Antaqor-ын ахиуц зардал ~тэг. Тиймээс үнэ
   нь зохион байгуулалт, интерфейс, програмын төлбөр л бөгөөд хямд байх
   нь зөв.

   Мета унших (`probe`) нь ҮНЭГҮЙ — хүн юу татахаа харахаасаа өмнө
   төлөх шаардлагагүй.

   Админ /admin дээрх тохиргооноос дарж өөрчилж болно (SiteSettings). */

export type YtTier = "sd" | "hd" | "uhd";

export interface YtPricing { sd: number; hd: number; uhd: number }

export const YT_DEFAULT_PRICING: YtPricing = { sd: 100, hd: 100, uhd: 200 }; // 2026-10-26: 1кр=₮1

export const YT_TIER_LABEL: Record<YtTier, string> = {
  sd: "480p хүртэл",
  hd: "720p–1080p",
  uhd: "1440p ба дээш",
};

export function tierFor(height: number): YtTier {
  const h = Number(height) || 0;
  if (h >= 1440) return "uhd";
  if (h >= 720) return "hd";
  return "sd";
}

export function costFor(p: YtPricing, height: number): number {
  return p[tierFor(height)];
}

export async function loadYtPricing(): Promise<YtPricing> {
  const p: YtPricing = { ...YT_DEFAULT_PRICING };
  const [sd, hd, uhd] = await Promise.all([
    getSetting("ytCostSd"), getSetting("ytCostHd"), getSetting("ytCostUhd"),
  ]);
  if (Number.isFinite(sd) && sd > 0) p.sd = Math.round(sd);
  if (Number.isFinite(hd) && hd > 0) p.hd = Math.round(hd);
  if (Number.isFinite(uhd) && uhd > 0) p.uhd = Math.round(uhd);
  return p;
}
