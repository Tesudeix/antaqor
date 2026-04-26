import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { pushToUser } from "@/lib/push";
import { maybeAwardReferralPayment } from "@/lib/credits";
import CreditTx from "@/models/CreditTx";

type Params = Promise<{ id: string }>;

// POST — one-click approve. Behaviour depends on Payment.kind:
//  - "membership" (default): grant/extend subscription, fire referral reward
//  - "credits":              atomically $inc user.credits, log a CreditTx
export async function POST(
  req: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(365, Number(body.days) || 30));

    await dbConnect();

    const payment = await Payment.findById(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (payment.status === "paid") {
      return NextResponse.json({ error: "Already approved" }, { status: 409 });
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    await payment.save();

    const user = await User.findById(payment.user);
    if (!user) return NextResponse.json({ error: "User gone" }, { status: 404 });

    // ─── Branch: credits purchase ─────────────────────────────────────────
    if (payment.kind === "credits") {
      const grant = Math.max(1, Math.min(100_000, Number(payment.creditAmount) || 0));
      if (grant <= 0) {
        return NextResponse.json({ error: "Payment has no creditAmount" }, { status: 400 });
      }
      // Atomic increment so concurrent admin clicks don't double-credit
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { credits: grant, creditsLifetime: grant } },
        { new: true, projection: { credits: 1 } }
      ).lean();
      const balanceAfter = (updated as unknown as { credits?: number } | null)?.credits || 0;

      await CreditTx.create({
        user: user._id,
        kind: "earn",
        amount: grant,
        reason: "PURCHASE",
        xpAwarded: 0,
        ref: String(payment._id),
        balanceAfter,
        meta: { packageId: payment.packageId, amount: payment.amount },
      });

      pushToUser(String(user._id), {
        title: `+${grant}₵ нэмэгдлээ`,
        body: `${grant} кредит данс руу шилжлээ. Шинэ үлдэгдэл: ${balanceAfter}₵`,
        url: "/credits",
        tag: `credits-purchase-${payment._id}`,
      }).catch(() => {});

      return NextResponse.json({
        ok: true,
        kind: "credits",
        payment: { _id: payment._id, status: payment.status, paidAt: payment.paidAt },
        user: { _id: user._id, credits: balanceAfter },
      });
    }

    // ─── Branch: membership (default) ─────────────────────────────────────
    const now = new Date();
    const base =
      user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
        ? new Date(user.subscriptionExpiresAt)
        : now;
    const expiresAt = new Date(base);
    expiresAt.setDate(expiresAt.getDate() + days);

    user.subscriptionExpiresAt = expiresAt;
    if (!user.clan) user.clan = "antaqor";
    if (!user.clanJoinedAt) user.clanJoinedAt = now;
    await user.save();

    maybeAwardReferralPayment(String(user._id)).catch(() => {});

    pushToUser(String(user._id), {
      title: "Cyber Empire идэвхжлээ 🚀",
      body: `${days} хоногийн гишүүнчлэл амжилттай. Тавтай морил!`,
      url: "/",
      tag: "membership-activated",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      kind: "membership",
      payment: { _id: payment._id, status: payment.status, paidAt: payment.paidAt },
      user: { _id: user._id, subscriptionExpiresAt: user.subscriptionExpiresAt, clan: user.clan },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
