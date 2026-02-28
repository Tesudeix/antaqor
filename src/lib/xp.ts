import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { calculateLevel, xpForLevel, getLevelTitle, getLevelProgress } from "./xpClient";

export { calculateLevel, xpForLevel, getLevelTitle, getLevelProgress };

export type XPAction =
  | "CREATE_POST"
  | "COMMENT"
  | "RECEIVE_LIKE"
  | "COMPLETE_LESSON"
  | "COMPLETE_TASK";

/**
 * Award XP to a user and recalculate their level.
 * Returns the updated user fields { xp, level }.
 */
export async function awardXP(
  userId: string,
  action: XPAction,
  amount: number,
  ref?: string
): Promise<{ xp: number; level: number } | null> {
  if (amount <= 0) return null;

  await dbConnect();

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $inc: { xp: amount },
      $push: {
        xpHistory: {
          action,
          amount,
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

  return { xp: user.xp, level: user.level };
}
