import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

const CLAN_PRICE = 25000;

function generateReferenceId(): string {
  const prefix = "R";
  const num = Math.floor(100000000 + Math.random() * 900000000);
  return `${prefix}${num}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await dbConnect();

    const existing = await Payment.findOne({
      user: userId,
      status: "pending",
      amount: CLAN_PRICE,
    });

    if (existing) {
      return NextResponse.json({
        referenceId: existing.senderCode,
        paymentId: existing._id,
      });
    }

    const referenceId = generateReferenceId();

    const payment = await Payment.create({
      user: userId,
      invoiceId: referenceId,
      senderCode: referenceId,
      amount: CLAN_PRICE,
      description: "Antaqor Clan Membership",
      status: "pending",
    });

    return NextResponse.json({
      referenceId,
      paymentId: payment._id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
