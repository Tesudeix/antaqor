import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { calculateLevel, xpForLevel, getLevelTitle, getLevelProgress } from "./xpClient";
import { getSetting } from "./siteSettings";
import { isAdmin } from "./admin";

export { calculateLevel, xpForLevel, getLevelTitle, getLevelProgress };

export type XPAction =
  | "CREATE_POST"
  | "COMMENT"
  | "RECEIVE_LIKE"
  | "COMPLETE_LESSON"
  | "COMPLETE_TASK";

/**
 * Award XP to a user and recalculate their level.
 * Paying members earn a multiplier (configurable via SiteSettings.paidXpMultiplier).
 * Returns the updated user fields { xp, level, awarded }.
 */
export async function awardXP(
  userId: string,
  action: XPAction,
  amount: number,
  ref?: string
): Promise<{ xp: number; level: number; awarded: number } | null> {
  if (amount <= 0) return null;

  await dbConnect();

  // Determine multiplier based on paid status
  const fresh = await User.findById(userId).select("subscriptionExpiresAt role email").lean();
  const u = fresh as unknown as { subscriptionExpiresAt?: Date; role?: string; email?: string } | null;
  const isPaid = !!(
    (u?.role === "admin" || isAdmin(u?.email)) ||
    (u?.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date())
  );

  const multiplier = isPaid ? await getSetting("paidXpMultiplier") : 1;
  const awarded = Math.max(1, Math.round(amount * multiplier));

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { xp: awarded },
      $push: {
        xpHistory: {
          action,
          amount: awarded,
          ref: ref || undefined,
          date: new Date(),
        },
      },
    },
    { new: true }
  );

  if (!user) return null;

  const newLevel = calculateLevel(user.xp);
  if (newLevel !== user.level) {
    user.level = newLevel;
    await user.save();
  }

  return { xp: user.xp, level: user.level, awarded };
}
