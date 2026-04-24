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

type Params = Promise<{ id: string }>;

// POST — one-click approve:
// 1. Mark Payment paid
// 2. Grant/extend user's subscription by 30 days
// 3. Fire referral-paid reward (idempotent)
// 4. Push to user: "You're in!"
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

    // Grant / extend subscription
    const user = await User.findById(payment.user);
    if (!user) return NextResponse.json({ error: "User gone" }, { status: 404 });

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

    // Fire referral-paid reward if applicable (non-blocking, idempotent)
    maybeAwardReferralPayment(String(user._id)).catch(() => {});

    // Notify user (non-blocking)
    pushToUser(String(user._id), {
      title: "Cyber Empire идэвхжлээ 🚀",
      body: `${days} хоногийн гишүүнчлэл амжилттай. Тавтай морил!`,
      url: "/",
      tag: "membership-activated",
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      payment: { _id: payment._id, status: payment.status, paidAt: payment.paidAt },
      user: { _id: user._id, subscriptionExpiresAt: user.subscriptionExpiresAt, clan: user.clan },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
