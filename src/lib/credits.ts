import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";
import Referral from "@/models/Referral";
import {
  CREDIT_REWARDS,
  DAILY_CAPS,
  REDEEM_OPTIONS,
  type CreditReason,
} from "./creditsConfig";
import { awardXP } from "./xp";
import { randomBytes } from "crypto";

// ─── Referral code generation ───
function generateReferralCode(): string {
  // 8-char slug from url-safe alphabet, lowercase, readable
  return randomBytes(6).toString("base64url").toLowerCase().slice(0, 8);
}

export async function ensureReferralCode(userId: string): Promise<string> {
  await dbConnect();
  const user = await User.findById(userId).select("referralCode");
  if (!user) throw new Error("user not found");
  if (user.referralCode) return user.referralCode;

  // retry a few times in the extremely unlikely case of collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const exists = await User.findOne({ referralCode: code }).select("_id").lean();
    if (exists) continue;
    user.referralCode = code;
    await user.save();
    return code;
  }
  throw new Error("could not allocate referral code");
}

export async function findUserByReferralCode(code: string): Promise<{ _id: string; name: string; avatar?: string } | null> {
  if (!code) return null;
  await dbConnect();
  const user = await User.findOne({ referralCode: code.toLowerCase() }).select("_id name avatar").lean();
  if (!user) return null;
  const u = user as unknown as { _id: { toString(): string }; name: string; avatar?: string };
  return { _id: u._id.toString(), name: u.name, avatar: u.avatar };
}

// ─── Award credits + synchronized XP, ledger-backed ───
interface AwardArgs {
  userId: string;
  reason: CreditReason;
  ref?: string;
  meta?: Record<string, unknown>;
  // optional override for cases where reason amount differs (referral paid etc.)
  credits?: number;
  xp?: number;
}

export async function awardCredits(args: AwardArgs): Promise<{ balance: number; awarded: number; xpAwarded: number } | null> {
  const { userId, reason, ref, meta } = args;
  await dbConnect();

  let credits = args.credits ?? 0;
  let xp = args.xp ?? 0;

  if (!args.credits && reason in CREDIT_REWARDS) {
    const reward = CREDIT_REWARDS[reason as keyof typeof CREDIT_REWARDS];
    credits = reward.credits;
    xp = xp || reward.xp;
  }

  if (credits <= 0 && xp <= 0) return null;

  // ─── Daily-cap guards (only apply to farmable reasons) ───
  const farmable: CreditReason[] = ["SHARE_POST", "SHARE_NEWS", "POST_CREATE", "LIKE_RECEIVED", "DAILY_LOGIN"];
  if (farmable.includes(reason)) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Share cap: count distinct share rewards today
    if (reason === "SHARE_POST" || reason === "SHARE_NEWS") {
      const todayShares = await CreditTx.countDocuments({
        user: userId,
        reason: { $in: ["SHARE_POST", "SHARE_NEWS"] },
        createdAt: { $gte: startOfDay },
      });
      if (todayShares >= DAILY_CAPS.SHARE_COUNT) {
        return { balance: -1, awarded: 0, xpAwarded: 0 };
      }
      if (ref) {
        const duplicate = await CreditTx.findOne({
          user: userId,
          reason,
          ref,
          createdAt: { $gte: startOfDay },
        }).select("_id").lean();
        if (duplicate) return { balance: -1, awarded: 0, xpAwarded: 0 };
      }
    }

    if (reason === "LIKE_RECEIVED") {
      const todayLikes = await CreditTx.countDocuments({
        user: userId,
        reason: "LIKE_RECEIVED",
        createdAt: { $gte: startOfDay },
      });
      if (todayLikes >= DAILY_CAPS.LIKE_RECEIVED) {
        return { balance: -1, awarded: 0, xpAwarded: 0 };
      }
    }

    if (reason === "DAILY_LOGIN") {
      const already = await CreditTx.findOne({
        user: userId,
        reason: "DAILY_LOGIN",
        createdAt: { $gte: startOfDay },
      }).select("_id").lean();
      if (already) return { balance: -1, awarded: 0, xpAwarded: 0 };
    }

    // Overall per-day ceiling
    const todayFarmed = await CreditTx.aggregate([
      {
        $match: {
          user: new (await import("mongoose")).Types.ObjectId(userId),
          kind: "earn",
          reason: { $in: farmable },
          createdAt: { $gte: startOfDay },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const already = todayFarmed[0]?.total || 0;
    if (already + credits > DAILY_CAPS.CREDITS_PER_DAY) {
      const remaining = DAILY_CAPS.CREDITS_PER_DAY - already;
      if (remaining <= 0) return { balance: -1, awarded: 0, xpAwarded: 0 };
      credits = remaining;
    }
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    {
      $inc: {
        credits: credits,
        creditsLifetime: credits,
      },
    },
    { new: true }
  ).select("credits");

  if (!updated) return null;

  await CreditTx.create({
    user: userId,
    kind: "earn",
    amount: credits,
    reason,
    xpAwarded: xp,
    ref: ref || "",
    balanceAfter: updated.credits,
    meta,
  });

  if (xp > 0) {
    // Map reason → existing XP action when possible
    const xpAction = reason === "POST_CREATE"
      ? "CREATE_POST"
      : reason === "LIKE_RECEIVED"
        ? "RECEIVE_LIKE"
        : "COMMENT"; // fallback bucket
    await awardXP(userId, xpAction, xp, ref).catch(() => {});
  }

  return { balance: updated.credits, awarded: credits, xpAwarded: xp };
}

// ─── Spend credits for membership redemption ───
export async function redeemForMembership(
  userId: string,
  optionIndex: number
): Promise<{ balance: number; expiresAt: Date; daysAdded: number }> {
  if (optionIndex < 0 || optionIndex >= REDEEM_OPTIONS.length) {
    throw new Error("Invalid redeem option");
  }
  const opt = REDEEM_OPTIONS[optionIndex];

  await dbConnect();

  // Atomic: decrement credits only if balance >= cost
  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: opt.credits } },
    { $inc: { credits: -opt.credits } },
    { new: true }
  );

  if (!user) {
    throw new Error("Кредит хүрэлцэхгүй байна");
  }

  const now = new Date();
  const base =
    user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
      ? new Date(user.subscriptionExpiresAt)
      : now;
  const newExpiry = new Date(base);
  newExpiry.setDate(newExpiry.getDate() + opt.days);

  user.subscriptionExpiresAt = newExpiry;
  if (!user.clan) user.clan = "antaqor";
  if (!user.clanJoinedAt) user.clanJoinedAt = now;
  await user.save();

  await CreditTx.create({
    user: userId,
    kind: "spend",
    amount: opt.credits,
    reason: "REDEEM_MEMBERSHIP",
    xpAwarded: 0,
    ref: "",
    balanceAfter: user.credits,
    meta: { days: opt.days, expiresAt: newExpiry },
  });

  return { balance: user.credits, expiresAt: newExpiry, daysAdded: opt.days };
}

// ─── Called from signup: set up referral relationship + welcome bonus ───
export async function initializeReferral(
  newUserId: string,
  referralCode: string | null
): Promise<{ referrer: string | null }> {
  await dbConnect();

  // Welcome bonus for the new user (always fires)
  await awardCredits({
    userId: newUserId,
    reason: "SIGNUP_BONUS",
  }).catch(() => null);

  // Pre-allocate a referral code for the new user so they can start sharing immediately
  await ensureReferralCode(newUserId).catch(() => null);

  if (!referralCode) return { referrer: null };

  const referrer = await findUserByReferralCode(referralCode);
  if (!referrer) return { referrer: null };
  if (referrer._id === String(newUserId)) return { referrer: null };

  // Link referee → referrer
  await User.findByIdAndUpdate(newUserId, { referredBy: referrer._id }).catch(() => null);

  // Create Referral record (idempotent on referee uniqueness)
  const existing = await Referral.findOne({ referee: newUserId }).lean();
  if (existing) return { referrer: referrer._id };

  const rec = await Referral.create({
    referrer: referrer._id,
    referee: newUserId,
    code: referralCode.toLowerCase(),
    signupAt: new Date(),
    awarded: { signup: false, firstPayment: false },
  });

  // Award the referrer signup bonus
  const awarded = await awardCredits({
    userId: referrer._id,
    reason: "REFERRAL_SIGNUP",
    ref: String(newUserId),
  }).catch(() => null);

  if (awarded && awarded.awarded > 0) {
    rec.awarded.signup = true;
    await rec.save();
    await User.findByIdAndUpdate(referrer._id, { $inc: { referralCount: 1 } });
  }

  return { referrer: referrer._id };
}

// ─── Called when a referee's first payment is confirmed (admin grant) ───
export async function maybeAwardReferralPayment(refereeUserId: string): Promise<boolean> {
  await dbConnect();

  const rec = await Referral.findOne({ referee: refereeUserId });
  if (!rec) return false;
  if (rec.awarded.firstPayment) return false;

  const res = await awardCredits({
    userId: String(rec.referrer),
    reason: "REFERRAL_PAID",
    ref: String(refereeUserId),
  }).catch(() => null);

  if (!res || res.awarded <= 0) return false;

  rec.firstPaymentAt = new Date();
  rec.awarded.firstPayment = true;
  await rec.save();
  return true;
}

// ─── Atomic spend ─── decrements balance only if it's >= amount.
// Returns { ok: false, balance } if not enough, otherwise records a CreditTx
// and returns { ok: true, balance } with the new balance.
export async function spendCredits(args: {
  userId: string;
  amount: number;
  reason: string;       // free-form for tool spends ("AI_IMAGE_GEN", "AI_EXTRACT", etc.)
  ref?: string;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean; balance: number; required: number }> {
  const { userId, amount, reason, ref, meta } = args;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid spend amount");
  }
  await dbConnect();

  // Atomic: only deduct if balance >= amount
  const updated = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    { $inc: { credits: -amount } },
    { new: true, projection: { credits: 1 } }
  ).lean();

  if (!updated) {
    const current = await User.findById(userId).select("credits").lean();
    return {
      ok: false,
      balance: (current as unknown as { credits?: number } | null)?.credits || 0,
      required: amount,
    };
  }

  const balanceAfter = (updated as unknown as { credits: number }).credits;
  await CreditTx.create({
    user: userId,
    kind: "spend",
    amount,
    reason,
    xpAwarded: 0,
    ref: ref || "",
    balanceAfter,
    meta: meta || {},
  });

  return { ok: true, balance: balanceAfter, required: amount };
}

// ─── Refund: gives credits back atomically (e.g. when AI call fails post-charge) ───
export async function refundCredits(args: {
  userId: string;
  amount: number;
  reason: string;
  ref?: string;
}): Promise<{ balance: number }> {
  const { userId, amount, reason, ref } = args;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid refund");
  await dbConnect();
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount } },
    { new: true, projection: { credits: 1 } }
  ).lean();
  const balanceAfter = (updated as unknown as { credits?: number } | null)?.credits || 0;
  await CreditTx.create({
    user: userId,
    kind: "earn",
    amount,
    reason: `${reason}_REFUND`,
    xpAwarded: 0,
    ref: ref || "",
    balanceAfter,
    meta: {},
  });
  return { balance: balanceAfter };
}

// ─── Admin: manual adjust (positive or negative) ───
export async function adminAdjustCredits(
  userId: string,
  amount: number,
  note?: string
): Promise<{ balance: number }> {
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Invalid amount");

  await dbConnect();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const nextBalance = Math.max(0, (user.credits || 0) + amount);
  const delta = nextBalance - (user.credits || 0);
  user.credits = nextBalance;
  if (delta > 0) user.creditsLifetime = (user.creditsLifetime || 0) + delta;
  await user.save();

  await CreditTx.create({
    user: userId,
    kind: amount >= 0 ? "earn" : "spend",
    amount: Math.abs(delta),
    reason: "ADMIN_ADJUST",
    xpAwarded: 0,
    ref: "",
    balanceAfter: user.credits,
    meta: { note: note || "" },
  });

  return { balance: user.credits };
}
