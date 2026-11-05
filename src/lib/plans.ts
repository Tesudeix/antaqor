// ─── Plan system — single source of truth ───
// Free → Runner → Дунд шат → Ахисан шат. Internal ids (starter/builder/
// operator) never change — DB, gating, and URLs depend on them; only the
// display layer (name, price, copy) lives here. Bank auto-matcher matches
// per-Payment amounts, so prices here flow through /api/clan/join → Payment.

// ─── 2026-08 (revised): Founding 100 is OFF SALE ───
// The launch offer is retired. BEGINNER / STARTER / PRO are what is sold now,
// and `founding` cannot be purchased any more (see PAID_PLANS below).
//
// Why the founding id survives its own retirement: nothing about it is dead
// weight yet. `/founders` queries paid founding payments to build the public
// wall, PLAN_RANK["founding"] is what would keep an existing holder's access
// alive, and isPaidPlanId must keep accepting it so the admin bank-matcher can
// still approve a founding transfer that lands after the shutter came down.
// Zero users hold it and zero founding payments exist today, so pulling the id
// would in fact be safe — but off-sale is a pricing change, and deleting an id
// that four other files still read is a migration nobody asked for.
//
// Their ids are deliberately NOT deleted, and this is not timidity. Six users
// currently hold `plan: "starter"` from six paid memberships, twenty-one more
// starter payments are pending approval, and twenty files gate content on
// PLAN_RANK[user.plan]. Removing the id would make PLAN_RANK[plan] undefined
// for every one of those people — six paying customers locked out of what
// they already paid for, silently, with no error anywhere. Off-sale is a
// pricing decision; deleting the id is a data migration, and nobody asked
// for one.
export type PlanId = "free" | "starter" | "builder" | "operator" | "founding";

export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  builder: 2,
  operator: 3,
  // Founding grants the full tier for its 3 months — there is nothing above it.
  founding: 3,
};

/** Founding 100 — hard cap and term. Both are enforced server-side. */
export const FOUNDING_CAP = 100;
export const FOUNDING_PERIOD_DAYS = 90; // "эхний 3 сар"

export interface PlanDef {
  id: PlanId;
  name: string;
  price: number; // MNT / month
  tagline: string; // positioning line
  forWho: string; // "Хэнд зориулагдсан"
  outcome: string; // core outcome
  benefits: string[]; // max 7 visible
  /** Сар бүр олгох credit. ОДООГООР ЗӨВХӨН ХАРУУЛАХ УТГА — олгох ба
      зарцуулах логик тусдаа хийгдэнэ (credit gate унтраалттай). */
  credits: number;
  cta: string;
  highlight?: boolean;
  /** Худалдан авалт хаалттай — "УДАХГҮЙ" төлөвтэй харагдана. */
  comingSoon?: boolean;
  /** Нэг удаагийн төлбөр — сар/жилийн сонголт байхгүй. */
  oneTime?: boolean;
  /** Хэдэн хоногийн эрх олгох вэ (заагаагүй бол сар/жилээр). */
  periodDays?: number;
  /** Нийт хэдэн хүн авах боломжтой (Founding 100). */
  cap?: number;
  accent: string; // tailwind-safe hex accent
}

/** Annual billing: pay for a year, get 20% off. */
export const ANNUAL_DISCOUNT = 0.2;

export function annualPrice(plan: PlanDef): number {
  // ЯГ 20%: 19,000 → 182,400 / 49,000 → 470,400 / 99,000 → 950,400.
  // Өмнө нь мянгаар тоймлодог байсан нь 182,000 гэж гаргаад зарласан
  // үнэтэй зөрдөг байв. Банкны автомат тааруулагч яг дүнгээр таних тул
  // энэ тоо зар сурталчилгаатайгаа таарах ёстой.
  return Math.round(plan.price * 12 * (1 - ANNUAL_DISCOUNT));
}

/** Trust: төлбөр төлөгдмөгц эрх автоматаар, шууд идэвхжинэ. Буцаан олголтын бодлого байхгүй. */
export const GUARANTEE_TEXT = "Төлбөр төлөгдмөгц эрх автоматаар идэвхжинэ";

/** Гишүүнчлэл БҮРД өгөгддөг эрхүүд. Гурван шат ижил жагсаалт заана. */
export const MEMBERSHIP_BENEFITS: string[] = [
  "Дижитал гишүүнчлэлийн карт",
  "Зөвхөн гишүүдэд зориулсан онцгой контент, постуудад хандах эрх",
  "Гишүүдийн хаалттай community орчинд оролцох эрх",
  "Гишүүнчлэл хүчинтэй хугацаанд тухайн концепц бүрийн Membership KIT-ийг нэг удаа худалдан авах боломж",
  "Зөвхөн гишүүдэд зориулсан албан ёсны merchandise бүтээгдэхүүн худалдан авах боломж",
];

/** Худалдан авалт хэзээ баталгаажсанд тооцох вэ. /pricing дээр харагдана. */
export const TERMS_TEXT =
  "Контентыг үзсэн тохиолдолд, эсвэл төлбөр хийснээс хойш худалдан авалт баталгаажсанд тооцно.";

export const PLANS: Record<PlanId, PlanDef> = {
  founding: {
    id: "founding",
    name: "Founding 100",
    price: 49000,
    credits: 4000,
    oneTime: true,
    periodDays: FOUNDING_PERIOD_DAYS,
    cap: FOUNDING_CAP,
    tagline: "Эхний 100 гишүүн — 3 сарын бүрэн эрх.",
    forWho: "Antaqor-ыг нэр болохоос нь өмнө итгэсэн анхдагчдад",
    outcome: "3 сарын турш бүх курс, даалгавар, өрөө, промптын сан бүрэн нээлттэй.",
    benefits: [
      "Бүх курс, богино хичээл нээлттэй",
      "Долоо хоног бүрийн даалгавар + шүүмж",
      "Промптын сангийн бүх багц",
      "Гишүүдийн хаалттай өрөө",
      "Анхдагчдын хананд насан турш нэр",
      "Үнэ өссөн ч таны үнэ хэвээрээ",
      "3 сарын бүрэн эрх (90 хоног)",
    ],
    cta: "Суудлаа баталгаажуулах",
    highlight: true,
    accent: "#2E29FF",
  },
  free: {
    id: "free",
    name: "ҮНЭГҮЙ",
    price: 0,
    credits: 150,
    tagline: "Эрсдэлгүйгээр системийг үз.",
    forWho: "Antaqor-ийг эхлээд туршиж үзэх хүн бүрт",
    outcome: "Эхний хичээл, эхний даалгавраа 24 цагийн дотор дуусга.",
    benefits: [
      "Үнэгүй богино хичээлүүд",
      "Промптын сангийн үнэгүй хэсэг",
      "Нэг эхлэлийн даалгавар",
      "Нээлттэй хэсэгт нэвтрэх эрх",
      "Явцын хяналт",
    ],
    cta: "Үнэгүй эхлэх",
    accent: "#9AA3AF",
  },
  starter: {
    id: "starter",
    /* 2026-10-04: 19,000 → 9,000. Банкны автомат тулгагч ДҮНГЭЭР
       таардаг тул энэ тоог солихын өмнө шалгасан: 19,000 дээр
       хүлээгдэж буй төлбөр 0 (5 нь аль хэдийн төлөгдсөн), 9,000 дээр
       11 хүлээгдэж байсан — өөрөөр хэлбэл хүмүүс аль хэдийн 9,000
       төлж байсан атал жагсаалт 19,000 гэж бичсээр байв. Энэ нь
       урсгалд байгаа төлбөр эвдэхгүй цорын ганц үе. */
    name: "СУУРЬ",
    price: 9000,
    credits: 1500,
    tagline: "AI-ийн суурийг зөв тавь.",
    forWho: "AI-г эхнээс нь системтэй сурч эхлэх хүнд",
    outcome: "Санамсаргүй видео үзэхээ больж, бүтэцтэй сургалтаар яв.",
    benefits: MEMBERSHIP_BENEFITS,
    cta: "Суурь гишүүн болох",
    accent: "#9AA3AF",
  },
  builder: {
    id: "builder",
    name: "ДУНД",
    price: 49000,
    credits: 4000,
    tagline: "AI-тай бодитоор бүтээж, ажилдаа ашигла.",
    forWho: "AI-г өдөр тутмын ажилдаа оруулахыг хүссэн хүнд",
    outcome: "Сурснаа ажил дээрээ ажиллуулж, тогтсон урсгал болго.",
    benefits: MEMBERSHIP_BENEFITS,
    cta: "Дунд гишүүн болох",
    highlight: true,
    accent: "#2E29FF",
  },
  operator: {
    id: "operator",
    name: "АХИСАН",
    price: 99000,
    credits: 10000,
    tagline: "AI системээр бизнесээ өсгө.",
    forWho: "Нухацтай бүтээгч, бизнес эрхлэгчдэд",
    outcome: "Систем, агент, автоматжуулалтаар бизнесээ томсго.",
    benefits: MEMBERSHIP_BENEFITS,
    cta: "Ахисан гишүүн болох",
    accent: "#2E29FF",
  },
};

/** WHAT IS FOR SALE. The pricing page renders exactly this array, so taking a
    plan off the market is a one-line change and nothing else in the app has
    to know. Runner / Дунд шат / Ахисан шат are off sale as of 2026-08. */
/* Худалдаанд байгаа бүх зүйл. Founding 100 ЭНД БАЙХГҮЙ — тийм ч учраас
   `isPurchasablePlanId("founding")` худал буцааж, /api/clan/join түүгээр
   шинэ төлбөр үүсгэхээс татгалзана. Дэлгэц дээр ч, серверт ч нэг эх сурвалж. */
export const PAID_PLANS: PlanDef[] = [
  PLANS.starter,
  PLANS.builder,
  PLANS.operator,
];

/* /pricing-ийн гулсуур. FREE энд БАЙГАА (харьцуулах цэг болдог, худалдан
   авалтгүй), Founding 100 байхгүй — зарагдахаа больсон. */
export const TIER_PLANS: PlanDef[] = [
  PLANS.free,
  PLANS.starter,
  PLANS.builder,
  PLANS.operator,
];

/** Plans a NEW purchase may be started for. Kept separate from isPaidPlanId,
    which must keep accepting the retired ids — twenty-one starter payments are
    sitting pending and the admin bank-matcher has to be able to approve them. */
export function isPurchasablePlanId(v: unknown): v is Exclude<PlanId, "free"> {
  return PAID_PLANS.some((p) => p.id === v && !p.comingSoon);
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "starter" || v === "builder" || v === "operator" || v === "founding";
}

export function isPaidPlanId(v: unknown): v is Exclude<PlanId, "free"> {
  return v === "starter" || v === "builder" || v === "operator" || v === "founding";
}

/** How many days of access a purchase grants. */
export function planPeriodDays(plan: PlanDef, period: "month" | "year"): number {
  if (plan.periodDays) return plan.periodDays;
  return period === "year" ? 365 : 30;
}

/** Does a user on `userPlan` get content that requires `required`? */
export function hasPlanAccess(userPlan: PlanId, required: PlanId): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[required];
}

/** What the upgrade modal should sell. Whatever the locked door required, the
    offer shown is the recommended tier — with founding retired, PAID_PLANS[0]
    is merely the cheapest plan, which is a weaker thing to put behind a lock
    than the one the pricing page itself stars. */
export function upgradeTarget(_required: PlanId): PlanDef {
  return PAID_PLANS.find((p) => p.highlight) || PAID_PLANS[0] || PLANS.builder;
}

export function formatMNT(n: number): string {
  return n.toLocaleString("en-US") + "₮";
}

// ─── Course tracks (roadmap grouping) ───
export type TrackId = "foundation" | "builder" | "operator";

export const TRACKS: { id: TrackId; name: string; requiredPlan: PlanId; desc: string }[] = [
  { id: "foundation", name: "FOUNDATION", requiredPlan: "free", desc: "AI-ийн суурь — эндээс эхэлнэ" },
  { id: "builder", name: "ДУНД ШАТ", requiredPlan: "builder", desc: "Бодит төсөл бүтээх системүүд" },
  { id: "operator", name: "АХИСАН ШАТ", requiredPlan: "operator", desc: "Бизнес, орлого, agentic систем" },
];
