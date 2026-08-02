// ─── AI chat credit gate ─────────────────────────────────────────────────
// Single source of truth for "can this user send another AI message right now?"
//
// Free tier: FREE_PER_DAY messages/day per logged-in user. After that, 1 credit
// per message via spendCredits(). Active /clan subscribers (and admins) bypass
// the gate entirely. Guests are gated upstream by lifetime cap, not credits.

import dbConnect from "@/lib/mongodb";
import CreditTx from "@/models/CreditTx";
import User from "@/models/User";
import { refundCredits } from "@/lib/credits";
import { isActiveMember } from "@/lib/membership";

export const AI_FREE_PER_DAY = 5;
export const AI_COST_PER_MESSAGE = 1;

export type AiReason = "AI_BUDJARGAL_MSG" | "AI_COMPANION_MSG";

export interface AiGateOk {
  ok: true;
  charged: boolean;        // false = used a free-quota slot or sub-bypass
  bypass: boolean;         // true = active member / admin
  freeUsedToday: number;
  freeRemainingToday: number;
  balanceAfter: number;
  requiredOnFail?: never;
}
export interface AiGateBlocked {
  ok: false;
  charged: false;
  reason: "INSUFFICIENT_CREDITS";
  balance: number;
  required: number;
  freeUsedToday: number;
  freeRemainingToday: 0;
}
export type AiGateResult = AiGateOk | AiGateBlocked;

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function gateAiMessage(args: {
  userId: string;
  email?: string | null;
  reason: AiReason;
  ref?: string;
}): Promise<AiGateResult> {
  const { userId, email, reason, ref } = args;
  await dbConnect();

  // 1. Active member → bypass entirely.
  if (await isActiveMember(userId, email || null)) {
    const balUser = await User.findById(userId).select("credits").lean();
    const balance = (balUser as unknown as { credits?: number } | null)?.credits || 0;
    return {
      ok: true,
      charged: false,
      bypass: true,
      freeUsedToday: 0,
      freeRemainingToday: AI_FREE_PER_DAY,
      balanceAfter: balance,
    };
  }

  // 2. Free daily quota — count today's spends + free-uses for this reason.
  // Free uses are recorded as CreditTx kind="spend" amount=0 reason="<reason>_FREE"
  // so we don't pollute the balance but still get countable history.
  const since = startOfTodayUtc();
  const usedToday = await CreditTx.countDocuments({
    user: userId,
    reason: { $in: [reason, `${reason}_FREE`] },
    createdAt: { $gte: since },
  });

  if (usedToday < AI_FREE_PER_DAY) {
    // Burn a free-quota slot. Zero-amount tx purely for accounting.
    const balUser = await User.findById(userId).select("credits").lean();
    const balance = (balUser as unknown as { credits?: number } | null)?.credits || 0;
    await CreditTx.create({
      user: userId,
      kind: "spend",
      amount: 0,
      reason: `${reason}_FREE`,
      xpAwarded: 0,
      ref: ref || "",
      balanceAfter: balance,
      meta: { free: true, slot: usedToday + 1, dailyCap: AI_FREE_PER_DAY },
    });
    return {
      ok: true,
      charged: false,
      bypass: false,
      freeUsedToday: usedToday + 1,
      freeRemainingToday: AI_FREE_PER_DAY - (usedToday + 1),
      balanceAfter: balance,
    };
  }

  // 3. Credits removed — past the free daily cap, AI requires membership (no credit purchase).
  return {
    ok: false,
    charged: false,
    reason: "INSUFFICIENT_CREDITS",
    balance: 0,
    required: 0,
    freeUsedToday: usedToday,
    freeRemainingToday: 0,
  };
}

// Refund a charged AI message (e.g. Grok upstream failed after we charged).
// No-op for bypass/free-quota uses.
export async function refundAiMessage(args: {
  userId: string;
  reason: AiReason;
  charged: boolean;
  ref?: string;
}): Promise<void> {
  if (!args.charged) return;
  try {
    await refundCredits({
      userId: args.userId,
      amount: AI_COST_PER_MESSAGE,
      reason: args.reason,
      ref: args.ref,
    });
  } catch {
    // best-effort
  }
}
