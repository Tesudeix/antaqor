import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { awardCredits } from "@/lib/credits";

// ─── Milestone reward schedule ───
// When streak hits one of these values (on check-in), fire a one-time bonus.
const STREAK_MILESTONES: Record<number, { credits: number; xp: number; label: string }> = {
  3: { credits: 5, xp: 15, label: "3 өдөр дараалан" },
  7: { credits: 25, xp: 50, label: "7 өдөр · нэг долоо хоног" },
  14: { credits: 60, xp: 120, label: "14 өдөр · хоёр долоо хоног" },
  30: { credits: 200, xp: 400, label: "30 өдөр · нэг сар" },
  60: { credits: 500, xp: 1000, label: "60 өдөр · 2 сар" },
  100: { credits: 1000, xp: 2000, label: "100 өдөр · гайхамшиг" },
  365: { credits: 5000, xp: 10000, label: "1 жил · домог" },
};

// Reset helpers
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export interface StreakResult {
  streakDays: number;
  streakBestDays: number;
  alreadyCheckedInToday: boolean;
  milestoneReached: boolean;
  milestoneLabel?: string;
  creditsAwarded: number;
  xpAwarded: number;
}

/**
 * Check in a user for today.
 * - Same calendar day as last check-in → noop
 * - Exactly 1 day gap → streak += 1
 * - 2+ day gap → streak resets to 1
 * Fires milestone credit reward if newly hit.
 */
export async function dailyCheckIn(userId: string): Promise<StreakResult> {
  await dbConnect();

  const user = await User.findById(userId).select("streakDays streakBestDays streakLastDate");
  if (!user) {
    return {
      streakDays: 0,
      streakBestDays: 0,
      alreadyCheckedInToday: false,
      milestoneReached: false,
      creditsAwarded: 0,
      xpAwarded: 0,
    };
  }

  const now = new Date();
  const last = user.streakLastDate ? new Date(user.streakLastDate) : null;

  // Same calendar day — noop
  if (last && daysBetween(last, now) === 0) {
    return {
      streakDays: user.streakDays || 0,
      streakBestDays: user.streakBestDays || 0,
      alreadyCheckedInToday: true,
      milestoneReached: false,
      creditsAwarded: 0,
      xpAwarded: 0,
    };
  }

  // Determine new streak
  let newStreak: number;
  if (!last) {
    newStreak = 1; // first ever check-in
  } else {
    const gap = daysBetween(last, now);
    newStreak = gap === 1 ? (user.streakDays || 0) + 1 : 1;
  }

  const newBest = Math.max(user.streakBestDays || 0, newStreak);

  user.streakDays = newStreak;
  user.streakBestDays = newBest;
  user.streakLastDate = now;
  await user.save();

  // Milestone reward
  const milestone = STREAK_MILESTONES[newStreak];
  let creditsAwarded = 0;
  let xpAwarded = 0;
  let milestoneReached = false;
  let milestoneLabel: string | undefined;

  if (milestone) {
    const res = await awardCredits({
      userId,
      reason: "DAILY_LOGIN",
      ref: `streak:${newStreak}`,
      meta: { streak: newStreak, label: milestone.label },
      credits: milestone.credits,
      xp: milestone.xp,
    }).catch(() => null);
    if (res && res.awarded > 0) {
      creditsAwarded = res.awarded;
      xpAwarded = res.xpAwarded;
      milestoneReached = true;
      milestoneLabel = milestone.label;
    }
  }

  return {
    streakDays: newStreak,
    streakBestDays: newBest,
    alreadyCheckedInToday: false,
    milestoneReached,
    milestoneLabel,
    creditsAwarded,
    xpAwarded,
  };
}

export const STREAK_MILESTONE_DAYS = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
