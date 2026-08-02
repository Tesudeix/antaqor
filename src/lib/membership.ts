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
