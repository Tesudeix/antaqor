import type { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { AgentMedia } from "@/models/AgentStudio";
import { AgentWorkspace, type IAgentWorkspace } from "@/models/AgentWorkspace";
import { planOf, MAIN } from "@/lib/agentWs";
import { refundCredits, spendCredits } from "@/lib/credits";
import { creditsFor, fmtCr } from "@/lib/creditEconomics";
import { getEcon } from "@/lib/creditEconomicsServer";

/* ─── AI Studio-ийн кредит (2026-10-26) ────────────────────────────────────────
   Гишүүн (бизнес багцгүй) Higgsfield-ийн бүтээлт бүрт кредит төлнө:
   кредит = ceil10( бодит $ өртөг × ханш × markup ). Эзэн ("main") ба бизнес/туршилт
   кредит төлөхгүй (тэд өөр хязгаартай). Амжилтгүй болсон бүтээлтийн кредит
   `refundFailedStudio()`-оор автоматаар буцна (AgentMedia.credits/payer/refunded). */

export const FREE_STUDIO = true;

type WsLean = Omit<IAgentWorkspace, keyof import("mongoose").Document>;

export class CreditShortError extends Error {
  constructor(public need: number, public balance: number) {
    super(`Кредит хүрэлцэхгүй — ${fmtCr(need)} хэрэгтэй, танд ${fmtCr(balance)} байна. Цэнэглээд дахин оролдоно уу.`);
  }
}

/** Энэ workspace кредитээр төлөх үү — тийм бол төлөгчийн userId */
export async function studioPayer(ws: string): Promise<string | null> {
  if (!ws || ws === MAIN) return null;
  await dbConnect();
  const w = await AgentWorkspace.findOne({ wsId: ws }).select("plan trialEndsAt paidUntil ownerUserId").lean<WsLean>();
  if (!w) return null;
  const p = planOf(w).plan;
  return p === "active" || p === "trial" ? null : w.ownerUserId;
}

/** n ширхэг (тус бүр usdEach) бүтээлтийн кредитийг урьдчилж хасна. Төлөх шаардлагагүй бол null. */
export async function chargeStudio(ws: string, usdEach: number, n: number, what: string): Promise<{ payer: string; per: number } | null> {
  /* 2026-11-02: AI Studio КРЕДИТГҮЙ болов (эзний хүсэлт) — хэнээс ч хасахгүй.
     Зардлыг agentStudio.budgetCheck-ийн өдрийн $ хязгаар барина. Буцаахдаа энэ мөрийг устга. */
  if (FREE_STUDIO) return null;
  const payer = await studioPayer(ws);
  if (!payer) return null;
  const e = await getEcon();
  const per = creditsFor(usdEach, e);
  const r = await spendCredits({ userId: payer, amount: per * n, reason: "AI_STUDIO", ref: what, meta: { usd: Math.round(usdEach * n * 10000) / 10000, n, fx: e.fx, markup: e.markup } });
  if (!r.ok) throw new CreditShortError(per * n, r.balance);
  /* админ/эзний данс төлбөргүй (spendCredits нь required 0 буцаана) → буцаалтгүй */
  return r.required > 0 ? { payer, per } : null;
}

/** Урьдчилж хассан кредитийг шууд буцаана (бүтээлт эхлээгүй үед) */
export async function refundCharge(ch: { payer: string; per: number } | null, n: number, what: string) {
  if (!ch || ch.per * n <= 0) return;
  await refundCredits({ userId: ch.payer, amount: ch.per * n, reason: "AI_STUDIO", ref: what }).catch(() => {});
}

/** Амжилтгүй болсон бүтээлтүүдийн кредитийг буцаана (нэг удаа — атомик тэмдэглэгээ) */
export async function refundFailedStudio(): Promise<number> {
  await dbConnect();
  const rows = await AgentMedia.find({ status: "failed", credits: { $gt: 0 }, refunded: { $ne: true } }).select("_id credits payer").limit(50).lean<{ _id: Types.ObjectId; credits: number; payer: string }[]>();
  let n = 0;
  for (const r of rows) {
    const claim = await AgentMedia.findOneAndUpdate({ _id: r._id, refunded: { $ne: true } }, { $set: { refunded: true } });
    if (!claim || !r.payer) continue;
    await refundCredits({ userId: r.payer, amount: r.credits, reason: "AI_STUDIO", ref: String(r._id) }).catch(() => {});
    n++;
  }
  return n;
}
