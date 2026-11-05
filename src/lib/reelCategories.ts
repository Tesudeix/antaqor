/* ─── REEL АНГИЛАЛ (2026-10-06) ───────────────────────────────────────────
   Сайт зөвхөн reel (видео) контенттой болсон. Reel бүр эдгээрийн НЭГ
   ангилалтай нийтлэгдэнэ; урсгал ба профайлын хавтангууд (ReelCategoryTiles)
   үүгээр шүүнэ. `slug` нь Post.category-д хадгалагдана — Category
   коллекцид ч мөр болж бий (API нь ангиллыг тэндээс шалгадаг). */
export const REEL_CATEGORIES = [
  { slug: "viral-reel", name: "Viral reel" },
  { slug: "effects", name: "Effects" },
  { slug: "styles", name: "Styles" },
  // 2026-10-09: нүүрний мөрүүд (ReelRow). "танилцуулга" нь хуучин ангиллын slug — давхар үүсгээгүй.
  { slug: "танилцуулга", name: "Танилцуулга" },
  { slug: "story", name: "Story" },
  { slug: "mission", name: "Mission" },
] as const;

export type ReelCategorySlug = (typeof REEL_CATEGORIES)[number]["slug"];

export const REEL_SLUGS: string[] = REEL_CATEGORIES.map((c) => c.slug);
export const DEFAULT_REEL_CATEGORY: ReelCategorySlug = "viral-reel";

export function reelCategoryName(slug?: string | null): string | null {
  return REEL_CATEGORIES.find((c) => c.slug === slug)?.name ?? null;
}
