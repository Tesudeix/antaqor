// Credit purchase tiers for Antaqor.
//
// Pricing logic (₮ per credit drops as tier rises):
//   Starter  → 50 ₮/credit  → entry, low risk for first-timers
//   Creator  → 40 ₮/credit  → 20% saving · the conversion sweet spot
//   Studio   → 30 ₮/credit  → 40% saving · power users + influencers
//   Empire   → 24 ₮/credit  → 52% saving · agencies / business
//
// Image-generation cost reference (so the copy stays accurate):
//   Standard image  = 10–15 ₵
//   HD image (1.5x) = 15–22 ₵
//
// "Энэ багц XX зураг" copy uses the cheapest model standard cost (10₵).

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;             // MNT total
  pricePerCredit: number;    // derived (display only)
  label: string;
  blurb: string;
  badge?: string;
  highlight?: boolean;
  saving?: number;           // % saving vs Starter — used by the picker UI
}

/* 2026-10-26: 1 кредит = 1₮ (эзний шийдвэр — «500 кредит бол 500 төгрөг»).
   Том багц нь ХЯМДРАЛ биш БОНУС кредит өгнө (+10/+20/+30%). Үйлдэл бүрийн үнэ
   = ceil10(өртөг$ × ханш × markup) (lib/creditEconomics.ts) — markup 2 үед
   хамгийн их бонустай багц дээр ч ~35% бохир ашигтай (/admin/economics).
   id-г өөрчлөөгүй — хуучин төлбөрийн бүртгэлүүд эвдрэхгүй.
   «≈ зураг» тоо нь GPT Image 2 «Сайн» (~410 кр, /api/credits/prices) дээр суурилсан. */
export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", credits: 5_000, price: 5_000, pricePerCredit: 1, label: "Эхлэл", blurb: "≈50 AI зураг · туршиж үзэхэд" },
  { id: "creator", credits: 22_000, price: 20_000, pricePerCredit: 0.91, label: "Бүтээгч", blurb: "≈220 зураг эсвэл 3 Kling видео", badge: "ХАМГИЙН ИХ АВДАГ", highlight: true, saving: 10 },
  { id: "studio", credits: 60_000, price: 50_000, pricePerCredit: 0.83, label: "Студи", blurb: "≈600 зураг эсвэл 10 Kling видео", saving: 20 },
  { id: "empire", credits: 130_000, price: 100_000, pricePerCredit: 0.77, label: "Бизнес", blurb: "≈1,300 зураг эсвэл 23 Kling видео", badge: "БИЗНЕС", saving: 30 },
];

export function findPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
