// ─── Hero слайдын загварууд ───
// Зөвхөн мета — админ болон рендер хоёуланг уншна.
// Шинэ загвар нэмэхээр энд нэмээд HomeLanding деэр layout-ын
// тусгай кодыг бичнэ.

export type HeroLayout = "split" | "poster" | "full" | "text";

export const DEFAULT_HERO_LAYOUT: HeroLayout = "split";

export const HERO_LAYOUTS: { key: HeroLayout; label: string; hint: string }[] = [
  { key: "split", label: "Split", hint: "Текст зүүн, дөрвөлжин зураг баруун" },
  { key: "poster", label: "Постер", hint: "Босоо 3:4 зураг — постерт тохирно" },
  { key: "full", label: "Дүүрэн", hint: "Зураг дэвсгэрт, текст дээр нь" },
  { key: "text", label: "Зөвхөн текст", hint: "Зураггүй, том гарчиг голдоо" },
];

export const HERO_LAYOUT_KEYS: string[] = HERO_LAYOUTS.map((l) => l.key);

export function normalizeHeroLayout(v: unknown): HeroLayout {
  return (HERO_LAYOUT_KEYS.includes(String(v)) ? String(v) : DEFAULT_HERO_LAYOUT) as HeroLayout;
}
