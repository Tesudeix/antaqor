import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isAdmin } from "@/lib/admin";

// ─── Server-side membership check ───
// Single source of truth for "is this user a paying member right now?"

export async function isActiveMember(userId: string, email?: string | null): Promise<boolean> {
  if (email && isAdmin(email)) return true;
  await dbConnect();
  const user = await User.findById(userId).select("subscriptionExpiresAt role").lean();
  if (!user) return false;
  const u = user as unknown as { subscriptionExpiresAt?: Date; role?: string };
  if (u.role === "admin") return true;
  return !!(u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date());
}

/* ─── ТӨЛБӨРТ ШИЛЖИХ — 2026-08-26 ─────────────────────────────────────────
   Сайт бүхэлдээ гишүүнчлэлтэй боллоо: үнэгүй урсгал, үнэгүй AI квот аль нь ч
   байхгүй. Зочин ЗӨВХӨН нүүр, /pricing, нэвтрэх хуудсыг харна — эс тэгвээс
   хэн ч бүртгүүлж, төлж чадахгүй болно.

   ХУГАЦАА (grace). Шилжих үед 662 хэрэглэгчийн 50 нь л төлбөрөө төлсөн
   байсан. Үлдсэн 612-г ямар ч анхааруулгагүйгээр таслах нь бүтээгдэхүүний
   шийдвэр биш, хэрэглэгчид хийж буй зүйл — тиймээс тэдэнд 7 хоног үлдээв.

   ХЭРХЭН АЖИЛЛАДАГ ВЭ: 612 мөрийг ЗАСАХГҮЙ. Хоёр огноог харьцуулж
   тооцоолно — хэрэглэгч cutover-оос ӨМНӨ бүртгүүлсэн бол grace дуустал
   эрхтэй. Ингэснээр (а) өгөгдөл нүүлгэх шаардлагагүй, (б) хугацаа өөрөө
   дуусна, (в) ШИНЭ бүртгэл grace-д ОГТ хамрагдахгүй — учир нь тэдний
   createdAt нь cutover-оос хойш.

   Хугацааг сунгах бол `.env.local` дахь PAYWALL_GRACE_UNTIL-ийг өөрчилж
   pm2 restart --update-env хийнэ. Дахин build хэрэггүй.                   */
export const PAYWALL_CUTOVER_AT = new Date(
  process.env.PAYWALL_CUTOVER_AT || "2026-08-26T05:00:00.000Z"
);
export const PAYWALL_GRACE_UNTIL = new Date(
  process.env.PAYWALL_GRACE_UNTIL || "2026-09-02T00:00:00.000Z"
);

export interface AccessState {
  ok: boolean;            // энэ хүн бүтээгдэхүүнийг ашиглаж болох уу
  isMember: boolean;      // идэвхтэй захиалгатай юу
  isAdmin: boolean;
  inGrace: boolean;       // хуучин хэрэглэгчийн түр эрхээр орж байна уу
  graceEndsAt: string | null;
  /* Үлдсэн хоногийг ЭНД тоолно, UI дээр биш. `Date.now()` нь render-ийн
     цэвэр байдлыг эвдэж, сервер/клиентийн зөрүү үүсгэдэг. */
  graceDaysLeft: number;
}

const DENIED: AccessState = {
  ok: false, isMember: false, isAdmin: false, inGrace: false, graceEndsAt: null, graceDaysLeft: 0,
};

export async function accessState(
  userId?: string | null,
  email?: string | null
): Promise<AccessState> {
  if (!userId) return { ...DENIED };
  if (email && isAdmin(email)) {
    return { ok: true, isMember: true, isAdmin: true, inGrace: false, graceEndsAt: null, graceDaysLeft: 0 };
  }

  await dbConnect();
  const user = await User.findById(userId).select("subscriptionExpiresAt role createdAt").lean();
  if (!user) return { ...DENIED };
  const u = user as unknown as { subscriptionExpiresAt?: Date; role?: string; createdAt?: Date };

  if (u.role === "admin") {
    return { ok: true, isMember: true, isAdmin: true, inGrace: false, graceEndsAt: null, graceDaysLeft: 0 };
  }

  const now = new Date();
  const member = !!(u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > now);
  if (member) {
    return { ok: true, isMember: true, isAdmin: false, inGrace: false, graceEndsAt: null, graceDaysLeft: 0 };
  }

  const grace =
    !!u.createdAt &&
    new Date(u.createdAt) < PAYWALL_CUTOVER_AT &&
    now < PAYWALL_GRACE_UNTIL;

  return {
    ok: grace,
    isMember: false,
    isAdmin: false,
    inGrace: grace,
    graceEndsAt: grace ? PAYWALL_GRACE_UNTIL.toISOString() : null,
    graceDaysLeft: grace
      ? Math.max(0, Math.ceil((PAYWALL_GRACE_UNTIL.getTime() - now.getTime()) / 86_400_000))
      : 0,
  };
}

/** Богино хэлбэр — зөвхөн "болох уу, үгүй юу" гэдэг л хэрэгтэй үед. */
export async function hasAccess(userId?: string | null, email?: string | null): Promise<boolean> {
  return (await accessState(userId, email)).ok;
}

// ─── Effective level = actual level, but capped for free users ───
export function effectiveLevel(actualLevel: number, isPaid: boolean, freeCap: number): number {
  if (isPaid) return Math.max(1, actualLevel);
  return Math.max(1, Math.min(actualLevel, freeCap));
}

// ─── Feed visibility band — [lo, hi] inclusive around effective level ───
export function feedBand(effLevel: number, band: number): { lo: number; hi: number } {
  return {
    lo: Math.max(1, effLevel - band),
    hi: effLevel + band,
  };
}
