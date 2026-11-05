/* ─── Кредитийн эдийн засаг (2026-10-26) — 1 кредит = 1₮ ──────────────────────
   Client-safe (DB импортгүй). Утгууд нь /admin/economics-аас засагдана
   (SiteSettings `credit_econ`, creditEconomicsServer.ts).

   ҮНЭ:   кредит = ceil10( өртөг$ × ханш × markup )
   АШИГ:  суурь багц дээр 1 − 1/markup; хамгийн их бонустай (+30%) багц дээр
          1 − 1.3/markup; дээр нь төлбөрийн шимтгэл (QPay) хасагдана.
   БЭЛЭГ: гишүүнчлэлийн үнийн aiShare%-ийг AI зардалд зориулна → тэр зардлыг
          markup-аар үржүүлсэн нь кредит (хэрэглэгч бүгдийг нь зарцуулсан ч
          гишүүнчлэлийн ашиг ≥ (100 − aiShare − шимтгэл)%). */

export type PlanId = "starter" | "builder" | "operator";

export type Econ = {
  /** ₮ / $ */
  fx: number;
  /** үнэ = өртөг × markup */
  markup: number;
  /** QPay/Wire шимтгэл % */
  feePct: number;
  /** гишүүнчлэлийн үнийн хэдэн %-ийг AI кредитэд зориулах (зөвлөмж тооцоонд) */
  aiShare: number;
  /** бүртгүүлэхэд өгөх кредит */
  signupBonus: number;
  /** гишүүнчлэл төлөхөд (30 хоног тутамд) өгөх кредит */
  starter: Record<PlanId, number>;
  /** үүнээс доош бол «кредит бага» сануулга */
  lowAt: number;
};

export const ECON_DEFAULT: Econ = {
  fx: 3580,
  markup: 2,
  feePct: 1.5,
  aiShare: 15,
  signupBonus: 500,
  starter: { starter: 4500, builder: 15000, operator: 30000 },
  lowAt: 500,
};

export const PLAN_PRICE_HINT: Record<PlanId, { label: string; price: number }> = {
  starter: { label: "Plus", price: 9000 },
  builder: { label: "Pro", price: 49000 },
  operator: { label: "Max", price: 100000 },
};

/** Хамгийн их багцын бонус (+30%) — CREDIT_PACKAGES-тэй ижил байх ёстой */
export const MAX_BONUS = 0.3;

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

export function normalizeEcon(raw: unknown): Econ {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Econ>;
  const st = (r.starter || {}) as Partial<Record<PlanId, number>>;
  return {
    fx: num(r.fx, ECON_DEFAULT.fx, 1000, 10000),
    markup: num(r.markup, ECON_DEFAULT.markup, 1.1, 10),
    feePct: num(r.feePct, ECON_DEFAULT.feePct, 0, 20),
    aiShare: num(r.aiShare, ECON_DEFAULT.aiShare, 0, 80),
    signupBonus: Math.round(num(r.signupBonus, ECON_DEFAULT.signupBonus, 0, 100000)),
    starter: {
      starter: Math.round(num(st.starter, ECON_DEFAULT.starter.starter, 0, 1000000)),
      builder: Math.round(num(st.builder, ECON_DEFAULT.starter.builder, 0, 1000000)),
      operator: Math.round(num(st.operator, ECON_DEFAULT.starter.operator, 0, 1000000)),
    },
    lowAt: Math.round(num(r.lowAt, ECON_DEFAULT.lowAt, 0, 100000)),
  };
}

/** $ өртөгтэй үйлдлийн кредит үнэ (10-аар дээш бөөрөнхийлнө, доод тал нь 10) */
export const creditsFor = (usd: number, e: Pick<Econ, "fx" | "markup">) =>
  Math.max(10, Math.ceil((Math.max(0, usd) * e.fx * e.markup) / 10) * 10);

/** Нэг кредитийн бидэнд ногдох ХАМГИЙН ИХ өртөг (₮) — хэрэглэгч бүгдийг зарцуулбал */
export const costPerCredit = (e: Pick<Econ, "markup">) => 1 / e.markup;

/** Багц: ₮/кредит орлого → бохир ашгийн хувь (шимтгэл хасаад) */
export function packageMargin(priceMnt: number, credits: number, e: Econ) {
  const revenue = priceMnt * (1 - e.feePct / 100);
  const cost = credits * costPerCredit(e);
  return { revenue, cost, profit: revenue - cost, pct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 };
}

/** Гишүүнчлэл + бэлэг кредит: хамгийн муу (бүгдийг зарцуулсан) ба хүлээгдэх (usage%) ашиг */
export function membershipMargin(priceMnt: number, giftCredits: number, e: Econ, usagePct = 60) {
  const revenue = priceMnt * (1 - e.feePct / 100);
  const worstCost = giftCredits * costPerCredit(e);
  const expCost = worstCost * (usagePct / 100);
  return {
    revenue,
    worstCost,
    worstProfit: revenue - worstCost,
    worstPct: revenue > 0 ? ((revenue - worstCost) / revenue) * 100 : 0,
    expProfit: revenue - expCost,
    expPct: revenue > 0 ? ((revenue - expCost) / revenue) * 100 : 0,
  };
}

/** aiShare%-ийн дүрмээр санал болгох бэлэг кредит (500-аар доош бөөрөнхийлнө) */
export const suggestGift = (priceMnt: number, e: Econ) =>
  Math.floor((priceMnt * (e.aiShare / 100) * e.markup) / 500) * 500;

export const fmtMnt = (n: number) => `${Math.round(n).toLocaleString("en-US")}₮`;
export const fmtCr = (n: number) => `${Math.round(n).toLocaleString("en-US")} кр`;
