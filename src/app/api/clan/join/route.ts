import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

const CLAN_PRICE = 25000;

export async function POST(req: NextRequest) {
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
      return NextResponse.json({
        referenceId: existing.senderCode,
        email: userEmail,
        paymentId: existing._id,
      });
    }

    const payment = await Payment.create({
      user: userId,
      invoiceId: `INV-${Date.now()}`,
      senderCode: userEmail,
      amount: CLAN_PRICE,
      description: `Antaqor Clan — ${userEmail}`,
      status: "pending",
    });

    return NextResponse.json({
      referenceId: userEmail,
      email: userEmail,
      paymentId: payment._id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
