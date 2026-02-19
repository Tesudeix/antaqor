import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { checkPayment } from "@/lib/qpay";
import Payment from "@/models/Payment";
import User from "@/models/User";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { invoiceId } = await req.json();
    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    await dbConnect();

    const payment = await Payment.findOne({ invoiceId });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.status === "paid") {
      return NextResponse.json({ status: "paid", alreadyPaid: true });
    }

    const result = await checkPayment(invoiceId);

    if (result.count > 0 && result.rows[0]?.payment_status === "PAID") {
      payment.status = "paid";
      payment.paidAt = new Date();
      await payment.save();

      await User.findByIdAndUpdate(payment.user, {
        clan: "antaqor",
        clanJoinedAt: new Date(),
      });

      return NextResponse.json({ status: "paid" });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
