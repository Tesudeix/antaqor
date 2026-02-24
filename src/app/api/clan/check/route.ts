import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { referenceId } = await req.json();
    if (!referenceId) {
      return NextResponse.json({ error: "Reference ID required" }, { status: 400 });
    }

    await dbConnect();

    const payment = await Payment.findOne({ senderCode: referenceId });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "paid") {
      return NextResponse.json({ status: "paid", alreadyPaid: true });
    }

    return NextResponse.json({ status: "submitted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
