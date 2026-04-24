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
  | "ADMIN_ADJUST";

export interface CreditReward {
  credits: number;
  xp: number;
}

export const CREDIT_REWARDS: Record<Exclude<CreditReason, "REDEEM_MEMBERSHIP" | "ADMIN_ADJUST">, CreditReward> = {
  SIGNUP_BONUS: { credits: 50, xp: 100 },
  REFERRAL_SIGNUP: { credits: 50, xp: 200 },
  REFERRAL_PAID: { credits: 500, xp: 1000 },
  SHARE_POST: { credits: 3, xp: 10 },
  SHARE_NEWS: { credits: 3, xp: 10 },
  POST_CREATE: { credits: 5, xp: 0 },
  LIKE_RECEIVED: { credits: 1, xp: 0 },
  DAILY_LOGIN: { credits: 2, xp: 5 },
};

// Anti-abuse guardrails
export const DAILY_CAPS = {
  SHARE_COUNT: 5,              // max distinct share rewards per day
  SHARE_PER_RESOURCE: 1,       // max 1 reward per post/news per day
  LIKE_RECEIVED: 20,
  CREDITS_PER_DAY: 200,        // hard ceiling (excluding referral/redeem/admin)
};

// Redeem options
export interface RedeemOption {
  credits: number;
  days: number;
  label: string;
  note?: string;
}

export const REDEEM_OPTIONS: RedeemOption[] = [
  { credits: 500, days: 14, label: "14 хоног" },
  { credits: 1000, days: 30, label: "30 хоног", note: "Хамгийн түгээмэл" },
  { credits: 2800, days: 90, label: "90 хоног", note: "7% хэмнэлт" },
];

// Friendly reason labels for UI
export const REASON_LABELS: Record<CreditReason, string> = {
  SIGNUP_BONUS: "Тавтай морил бонус",
  REFERRAL_SIGNUP: "Найз бүртгүүлсэн",
  REFERRAL_PAID: "Найз Cyber Empire-д нэгдсэн",
  SHARE_POST: "Пост хуваалцсан",
  SHARE_NEWS: "Мэдээ хуваалцсан",
  POST_CREATE: "Пост нийтэлсэн",
  LIKE_RECEIVED: "Лайк авсан",
  DAILY_LOGIN: "Өдөр тутмын нэвтрэлт",
  REDEEM_MEMBERSHIP: "Гишүүнчлэл рүү солисон",
  ADMIN_ADJUST: "Админ тохируулга",
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
