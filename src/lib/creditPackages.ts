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

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    credits: 100,
    price: 5_000,
    pricePerCredit: 50,
    label: "Starter",
    blurb: "≈10 зураг · туршиж үзэхэд",
  },
  {
    id: "creator",
    credits: 500,
    price: 20_000,
    pricePerCredit: 40,
    label: "Creator",
    blurb: "≈50 зураг · хобби болон контент бүтээгчдэд",
    badge: "ХАМГИЙН ИХ АВДАГ",
    highlight: true,
    saving: 20,
  },
  {
    id: "studio",
    credits: 2_000,
    price: 60_000,
    pricePerCredit: 30,
    label: "Studio",
    blurb: "≈200 зураг · агентлаг, инфлүенсерүүдэд",
    saving: 40,
  },
  {
    id: "empire",
    credits: 5_000,
    price: 120_000,
    pricePerCredit: 24,
    label: "Empire",
    blurb: "≈500 зураг · бизнесийн өдөр тутмын ачаалалд",
    badge: "БИЗНЕС",
    saving: 52,
  },
];

export function findPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
