// ─── Credit economy parameters ───
// Single source of truth. Tune these values to rebalance the economy.

export type CreditReason =
  | "SIGNUP_BONUS"
  | "REFERRAL_SIGNUP"
  | "REFERRAL_PAID"
  | "SHARE_POST"
  | "SHARE_NEWS"
  | "POST_CREATE"
  | "LIKE_RECEIVED"
  | "DAILY_LOGIN"
  | "REDEEM_MEMBERSHIP"
  | "ADMIN_ADJUST"
  | "MEMBERSHIP_BONUS";

export interface CreditReward {
  credits: number;
  xp: number;
}

/* 2026-10-26: 1 кредит = 1₮. Бүртгэлийн бэлгийн хэмжээ нь /admin/economics-ийн
   `signupBonus` (энд байгаа 500 нь зөвхөн нөөц утга). */
export const CREDIT_REWARDS: Record<Exclude<CreditReason, "REDEEM_MEMBERSHIP" | "ADMIN_ADJUST" | "MEMBERSHIP_BONUS">, CreditReward> = {
  SIGNUP_BONUS: { credits: 500, xp: 100 },
  REFERRAL_SIGNUP: { credits: 500, xp: 200 },
  REFERRAL_PAID: { credits: 5000, xp: 1000 },
  SHARE_POST: { credits: 50, xp: 10 },
  SHARE_NEWS: { credits: 50, xp: 10 },
  POST_CREATE: { credits: 50, xp: 0 },
  LIKE_RECEIVED: { credits: 10, xp: 0 },
  DAILY_LOGIN: { credits: 50, xp: 5 },
};

// Anti-abuse guardrails
export const DAILY_CAPS = {
  SHARE_COUNT: 5,              // max distinct share rewards per day
  SHARE_PER_RESOURCE: 1,       // max 1 reward per post/news per day
  LIKE_RECEIVED: 20,
  CREDITS_PER_DAY: 2000,       // hard ceiling (excluding referral/redeem/admin) — 1 кр = 1₮
};

// Redeem options
export interface RedeemOption {
  credits: number;
  days: number;
  label: string;
  note?: string;
}

/* 1 кр = 1₮ — гишүүнчлэлийн үнэтэй ойролцоо (Pro 49,000₮ / 30 хоног) */
export const REDEEM_OPTIONS: RedeemOption[] = [
  { credits: 25000, days: 14, label: "14 хоног" },
  { credits: 49000, days: 30, label: "30 хоног", note: "Хамгийн түгээмэл" },
  { credits: 135000, days: 90, label: "90 хоног", note: "8% хэмнэлт" },
];

// Friendly reason labels for UI
export const REASON_LABELS: Record<CreditReason, string> = {
  SIGNUP_BONUS: "Тавтай морил бонус",
  REFERRAL_SIGNUP: "Найз бүртгүүлсэн",
  REFERRAL_PAID: "Найз Antaqor хүрээлэлд нэгдсэн",
  SHARE_POST: "Пост хуваалцсан",
  SHARE_NEWS: "Мэдээ хуваалцсан",
  POST_CREATE: "Пост нийтэлсэн",
  LIKE_RECEIVED: "Лайк авсан",
  DAILY_LOGIN: "Өдөр тутмын нэвтрэлт",
  REDEEM_MEMBERSHIP: "Гишүүнчлэл рүү солисон",
  ADMIN_ADJUST: "Админ тохируулга",
  MEMBERSHIP_BONUS: "Гишүүнчлэлийн бэлэг кредит",
};

// Canonical referral-link builder — single source of truth
export function buildInviteUrl(code: string, origin = "https://antaqor.com"): string {
  return `${origin}/auth/signup?ref=${encodeURIComponent(code)}`;
}

export function buildShareUrl(path: string, code: string | null, origin = "https://antaqor.com"): string {
  const base = `${origin}${path}`;
  if (!code) return base;
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${joiner}ref=${encodeURIComponent(code)}&utm_source=share&utm_medium=member`;
}
