// Credit purchase tiers. Pricing is in MNT (₮).
// Larger tiers get a bigger discount per credit to nudge bulk buys.
export interface CreditPackage {
  id: string;
  credits: number;
  price: number;             // MNT total
  pricePerCredit: number;    // derived (display only)
  label: string;
  blurb: string;             // short Mongolian copy
  badge?: string;            // e.g. "ХАМГИЙН ИХ АВДАГ"
  highlight?: boolean;       // visual emphasis in the picker
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    credits: 50,
    price: 5_000,
    pricePerCredit: 100,
    label: "Starter",
    blurb: "5 AI зураг үүсгэлт · туршихад тохиромжтой",
  },
  {
    id: "popular",
    credits: 200,
    price: 15_000,
    pricePerCredit: 75,
    label: "Popular",
    blurb: "20 AI зураг үүсгэлт · 25% хямд",
    badge: "ХАМГИЙН ИХ АВДАГ",
    highlight: true,
  },
  {
    id: "pro",
    credits: 500,
    price: 30_000,
    pricePerCredit: 60,
    label: "Pro",
    blurb: "50 AI зураг үүсгэлт · 40% хямд",
  },
];

export function findPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}
