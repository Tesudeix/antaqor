// ─── AI chat gate ────────────────────────────────────────────────────────
// Single source of truth for "can this user send another AI message right now?"
//
// 2026-08-26 — ҮНЭГҮЙ КВОТ УСТСАН. Өмнө нь нэвтэрсэн хүн өдөрт 5 үнэгүй
// мессеж авдаг байв. Сайт бүхэлдээ төлбөрт шилжсэн тул одоо ганц л асуулт
// байна: энэ хүн эрхтэй юу? (идэвхтэй захиалга, эсвэл шилжилтийн 7 хоногийн
// түр эрх — `accessState`-г үз).
//
// Тоолуурын түүх (CreditTx) ХЭВЭЭР бичигдэнэ: хэрэглээг харах нь эрхээс
// тусдаа хэрэгцээ бөгөөд /admin дээрх тайлангууд түүнээс уншдаг.

import dbConnect from "@/lib/mongodb";
import CreditTx from "@/models/CreditTx";
import User from "@/models/User";
import { refundCredits } from "@/lib/credits";
import { accessState } from "@/lib/membership";

// Үнэгүй квот байхгүй. Экспортыг үлдээсэн шалтгаан: хариултын биед
// `freeCap` талбараар явдаг тул консюмерууд эвдрэхгүй. Утга нь 0 —
// худал 5 гэж хэлэхээс дээр.
export const AI_FREE_PER_DAY = 0;
export const AI_COST_PER_MESSAGE = 100; // 2026-10-26: 1 кр = 1₮

// AI_SCOUT_MSG — Korean Food Scout. Тусдаа тоолуур зохиосонгүй: хоёр өөр
// газар өдрийн хязгаарыг өөрөөр тоолж эхэлбэл аль нэг нь худал болно.
export type AiReason = "AI_BUDJARGAL_MSG" | "AI_COMPANION_MSG" | "AI_SCOUT_MSG";

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
  reason: "NEEDS_MEMBERSHIP";
  needsMembership: true;
  balance: number;
  required: number;
  freeUsedToday: number;
  freeRemainingToday: 0;
}
export type AiGateResult = AiGateOk | AiGateBlocked;

export async function gateAiMessage(args: {
  userId: string;
  email?: string | null;
  reason: AiReason;
  ref?: string;
}): Promise<AiGateResult> {
  const { userId, email, reason, ref } = args;
  await dbConnect();

  const access = await accessState(userId, email || null);
  if (!access.ok) {
    return {
      ok: false,
      charged: false,
      reason: "NEEDS_MEMBERSHIP",
      needsMembership: true,
      balance: 0,
      required: 0,
      freeUsedToday: 0,
      freeRemainingToday: 0,
    };
  }

  /* Эрхтэй → хязгааргүй. Гэхдээ хэрэглээг ҮРГЭЛЖЛҮҮЛЭН бичнэ: хэн хэр их
     AI хэрэглэж байгааг мэдэхгүй бол өртөг хэзээ хяналтаас гарахыг ч
     мэдэхгүй. Дүн 0 тул үлдэгдэлд нөлөөлөхгүй, зөвхөн түүх үлдэнэ. */
  const balUser = await User.findById(userId).select("credits").lean();
  const balance = (balUser as unknown as { credits?: number } | null)?.credits || 0;

  try {
    await CreditTx.create({
      user: userId,
      kind: "spend",
      amount: 0,
      reason: `${reason}_MEMBER`,
      xpAwarded: 0,
      ref: ref || "",
      balanceAfter: balance,
      meta: { member: access.isMember, grace: access.inGrace },
    });
  } catch {
    // Бүртгэл бичигдэхгүй байх нь хариултыг зогсоох шалтгаан биш.
  }

  return {
    ok: true,
    charged: false,
    bypass: true,
    freeUsedToday: 0,
    freeRemainingToday: 0,
    balanceAfter: balance,
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
