import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { createWireCheckoutForPayment, wireEnabled } from "@/lib/wire";

export const dynamic = "force-dynamic";

/**
 * Start a Wire hosted checkout for the user's latest pending plan payment
 * (created by /api/clan/join). Amount comes from the Payment record — the
 * client sends nothing. On success the pricing page's status poll (or the
 * user returning via success_url) flips the payment to paid automatically.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!wireEnabled()) {
      return NextResponse.json({ error: "wire_disabled" }, { status: 503 });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const payment = await Payment.findOne({ user: userId, status: "pending" }).sort({
      createdAt: -1,
    });
    if (!payment) {
      return NextResponse.json({ error: "no_pending_payment" }, { status: 400 });
    }

    const buyer = (await User.findById(userId)
      .select("username phone email name")
      .lean()) as { username?: string; phone?: string; email?: string; name?: string } | null;
    const buyerTag =
      buyer?.username || buyer?.phone || buyer?.email || buyer?.name || userId;

    const { intentId, url } = await createWireCheckoutForPayment({
      paymentId: String(payment._id),
      amountTugrik: payment.amount,
      plan: payment.plan || "",
      userId,
      description: `Antaqor ${payment.plan || "plan"} · ${buyerTag}`,
    });
    payment.wireIntentId = intentId;
    await payment.save();

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[wire/checkout]", e);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
