import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { createInvoice } from "@/lib/qpay";
import Payment from "@/models/Payment";
import { randomUUID } from "crypto";

const CLAN_PRICE = 29900;
const CALLBACK_URL = process.env.QPAY_CALLBACK_URL || "https://tesudeix.com/clan";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    await dbConnect();

    const senderCode = `CLAN-${userId}-${Date.now()}`;

    const invoice = await createInvoice({
      invoiceDescription: "Antaqor Clan Membership",
      senderCode,
      amount: CLAN_PRICE,
      callbackUrl: `${CALLBACK_URL}?sender=${senderCode}`,
    });

    await Payment.create({
      user: userId,
      invoiceId: invoice.invoice_id,
      senderCode,
      amount: CLAN_PRICE,
      description: "Antaqor Clan Membership",
      status: "pending",
      qrImage: invoice.qr_image,
      qrText: invoice.qr_text,
    });

    return NextResponse.json({
      invoiceId: invoice.invoice_id,
      qrImage: invoice.qr_image,
      qrText: invoice.qr_text,
      urls: invoice.urls,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
