import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { generateUniqueRefCode } from "@/lib/paymentCode";
import { PLANS, annualPrice, isPaidPlanId, type PlanId } from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const userEmail = session.user.email || "";

    // Plan + billing period come from the pricing page; legacy callers
    // without a body get monthly starter.
    let plan: PlanId = "starter";
    let period: "month" | "year" = "month";
    try {
      const body = await req.json();
      if (isPaidPlanId(body?.plan)) plan = body.plan;
      if (PLANS[plan].comingSoon) {
        return NextResponse.json({ error: "plan_unavailable" }, { status: 400 });
      }
      if (body?.period === "year") period = "year";
    } catch {
      /* no body — legacy clan join */
    }
    const price = period === "year" ? annualPrice(PLANS[plan]) : PLANS[plan].price;
    const periodDays = period === "year" ? 365 : 30;

    await dbConnect();

    // Reuse a pending payment for the SAME plan+amount; a pending payment for
    // a different selection gets superseded (marked failed) so the ref code
    // the user sees always matches the amount they're about to transfer.
    const existing = await Payment.findOne({
      user: userId,
      status: "pending",
      kind: "membership",
    }).sort({ createdAt: -1 });

    if (existing && existing.amount === price) {
      if (!existing.referenceCode) {
        existing.referenceCode = await generateUniqueRefCode();
      }
      if (!existing.plan) existing.plan = plan;
      if (!existing.periodDays) existing.periodDays = periodDays;
      await existing.save();
      return NextResponse.json({
        paymentId: existing._id,
        referenceCode: existing.referenceCode,
        referenceId: existing.senderCode,
        email: userEmail,
        amount: existing.amount,
        plan: existing.plan || plan,
        period,
        status: existing.status,
        hasReceipt: !!existing.receiptImage,
      });
    }

    if (existing) {
      existing.status = "failed";
      existing.adminNote = `Superseded by new ${plan}/${period} selection`;
      await existing.save();
    }

    const referenceCode = await generateUniqueRefCode();

    const payment = await Payment.create({
      user: userId,
      invoiceId: `INV-${Date.now()}`,
      senderCode: userEmail,
      referenceCode,
      amount: price,
      plan,
      periodDays,
      kind: "membership",
      description: `Antaqor ${PLANS[plan].name} (${period === "year" ? "жил" : "сар"}) — ${userEmail}`,
      status: "pending",
    });

    return NextResponse.json({
      paymentId: payment._id,
      referenceCode: payment.referenceCode,
      referenceId: userEmail,
      email: userEmail,
      amount: payment.amount,
      plan,
      period,
      status: "pending",
      hasReceipt: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
