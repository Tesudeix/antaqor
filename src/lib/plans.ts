// ─── Plan system — single source of truth ───
// Free → Runner → Netrunner → Edgerunner. Internal ids (starter/builder/
// operator) never change — DB, gating, and URLs depend on them; only the
// display layer (name, price, copy) lives here. Bank auto-matcher matches
// per-Payment amounts, so prices here flow through /api/clan/join → Payment.

export type PlanId = "free" | "starter" | "builder" | "operator";

export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  builder: 2,
  operator: 3,
};

export interface PlanDef {
  id: PlanId;
  name: string;
  price: number; // MNT / month
  tagline: string; // positioning line
  forWho: string; // "Хэнд зориулагдсан"
  outcome: string; // core outcome
  benefits: string[]; // max 7 visible
  cta: string;
  highlight?: boolean;
  /** Худалдан авалт хаалттай — "УДАХГҮЙ" төлөвтэй харагдана. */
  comingSoon?: boolean;
  accent: string; // tailwind-safe hex accent
}

/** Annual billing: pay for a year, get 20% off. */
export const ANNUAL_DISCOUNT = 0.2;

export function annualPrice(plan: PlanDef): number {
  return Math.round((plan.price * 12 * (1 - ANNUAL_DISCOUNT)) / 1000) * 1000;
}

/** Trust: төлбөр төлөгдмөгц эрх автоматаар, шууд идэвхжинэ. Буцаан олголтын бодлого байхгүй. */
export const GUARANTEE_TEXT = "Төлбөр төлөгдмөгц эрх автоматаар идэвхжинэ";

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    tagline: "Эрсдэлгүйгээр системийг үз.",
    forWho: "Antaqor-ийг эхлээд туршиж үзэх хүн бүрт",
    outcome: "Эхний хичээл + эхний mission-оо 24 цагийн дотор дуусга.",
    benefits: [
      "Free reel хичээлүүд",
      "Prompt багцын үнэгүй слайдууд",
      "1 starter mission",
      "Community нэвтрэх эрх",
      "Progress хяналт",
    ],
    cta: "Нэгдэх",
    accent: "#9AA3AF",
  },
  starter: {
    id: "starter",
    name: "Runner",
    price: 9900,
    tagline: "Бүх курс + prompt сан — системтэй сур.",
    forWho: "AI-г бодитоор сурч эхлэх хүнд",
    outcome: "Random контентоос гарч, бүтэцтэй сургалтаар яв.",
    benefits: [
      "Бүх курс, reel хичээл нээлттэй",
      "Prompt сангийн бүх багц",
      "Starter mission-ууд",
      "Community нэвтрэх эрх",
      "Суурь template-ууд",
      "Progress хяналт",
    ],
    cta: "Runner болох",
    highlight: true,
    accent: "#3B82F6",
  },
  builder: {
    id: "builder",
    name: "Netrunner",
    price: 49000,
    tagline: "Mission + feedback — ганцаараа биш.",
    forWho: "Тогтмол бодит төсөл бүтээхийг хүссэн хүнд",
    outcome: "Долоо хоног бүр ship хийж, feedback-ээр хурдан өс.",
    benefits: [
      "Runner-ийн бүх зүйл",
      "Бүх долоо хоногийн mission",
      "Mission submission + feedback",
      "Netrunner-only өрөөнүүд",
      "Premium template-ууд",
      "Төслийн showcase",
    ],
    cta: "Netrunner болох",
    comingSoon: true,
    accent: "#1080CA",
  },
  operator: {
    id: "operator",
    name: "Edgerunner",
    price: 120000,
    tagline: "1:1 дэмжлэг — хамгийн ойрын тойрог.",
    forWho: "Нухацтай builder, бизнес эрхлэгчдэд",
    outcome: "Шууд feedback, accountability-тэйгээр хамгийн хурдан бүтээ.",
    benefits: [
      "Netrunner-ийн бүх зүйл",
      "Сар бүр 1:1 session",
      "Экспертийн шууд feedback + priority review",
      "Хаалттай Edgerunner тойрог",
      "Орлогод чиглэсэн mission-ууд",
      "Шинэ курс, tool-д early access",
    ],
    cta: "Edgerunner болох",
    comingSoon: true,
    accent: "#1080CA",
  },
};

export const PAID_PLANS: PlanDef[] = [PLANS.starter, PLANS.builder, PLANS.operator];

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "starter" || v === "builder" || v === "operator";
}

export function isPaidPlanId(v: unknown): v is Exclude<PlanId, "free"> {
  return v === "starter" || v === "builder" || v === "operator";
}

/** Does a user on `userPlan` get content that requires `required`? */
export function hasPlanAccess(userPlan: PlanId, required: PlanId): boolean {
  return PLAN_RANK[userPlan] >= PLAN_RANK[required];
}

/** Cheapest plan that unlocks `required` — what the upgrade modal should sell. */
export function upgradeTarget(required: PlanId): PlanDef {
  return PLANS[required === "free" ? "starter" : required];
}

export function formatMNT(n: number): string {
  return n.toLocaleString("en-US") + "₮";
}

// ─── Course tracks (roadmap grouping) ───
export type TrackId = "foundation" | "builder" | "operator";

export const TRACKS: { id: TrackId; name: string; requiredPlan: PlanId; desc: string }[] = [
  { id: "foundation", name: "FOUNDATION", requiredPlan: "free", desc: "AI-ийн суурь — эндээс эхэлнэ" },
  { id: "builder", name: "NETRUNNER", requiredPlan: "builder", desc: "Бодит төсөл бүтээх системүүд" },
  { id: "operator", name: "EDGERUNNER", requiredPlan: "operator", desc: "Бизнес, орлого, agentic систем" },
];
