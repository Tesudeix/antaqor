import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { generateUniqueRefCode } from "@/lib/paymentCode";

const CLAN_PRICE = 49000;

export async function POST(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const userEmail = session.user.email || "";

    await dbConnect();

    const existing = await Payment.findOne({
      user: userId,
      status: "pending",
      amount: CLAN_PRICE,
    });

    if (existing) {
      // Backfill a refCode if this was created before the feature shipped
      if (!existing.referenceCode) {
        existing.referenceCode = await generateUniqueRefCode();
        await existing.save();
      }
      return NextResponse.json({
        paymentId: existing._id,
        referenceCode: existing.referenceCode,
        referenceId: existing.senderCode,
        email: userEmail,
        amount: existing.amount,
        status: existing.status,
        hasReceipt: !!existing.receiptImage,
      });
    }

    const referenceCode = await generateUniqueRefCode();

    const payment = await Payment.create({
      user: userId,
      invoiceId: `INV-${Date.now()}`,
      senderCode: userEmail,
      referenceCode,
      amount: CLAN_PRICE,
      description: `Antaqor Clan — ${userEmail}`,
      status: "pending",
    });

    return NextResponse.json({
      paymentId: payment._id,
      referenceCode: payment.referenceCode,
      referenceId: userEmail,
      email: userEmail,
      amount: payment.amount,
      status: "pending",
      hasReceipt: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
