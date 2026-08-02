import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import MarketProduct from "@/models/MarketProduct";
import { generateUniqueRefCode } from "@/lib/paymentCode";

// Reuses the site's existing static QR (/qpay.png) + Khaan bank info.
const BANK = { name: "Хаан банк", account: "5926153085", recipient: "Баянбилэг Дамбадаржаа" };

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });

    const userId = (session.user as { id: string }).id;
    const email = session.user.email || "";
    const { slug } = await req.json();
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    await dbConnect();
    const product = await MarketProduct.findOne({ slug }).lean();
    if (!product) return NextResponse.json({ error: "Бараа олдсонгүй" }, { status: 404 });

    const amount = (product as unknown as { price?: number }).price || 0;
    const title = (product as unknown as { title?: string }).title || "Бараа";

    // Reuse an existing pending payment for this product + user.
    let payment = await Payment.findOne({ user: userId, status: "pending", description: `Бараа: ${title}` });
    if (!payment) {
      const referenceCode = await generateUniqueRefCode();
      payment = await Payment.create({
        user: userId,
        invoiceId: `MKT-${Date.now()}`,
        senderCode: email,
        referenceCode,
        amount,
        description: `Бараа: ${title}`,
        kind: "product",
        status: "pending",
        qrImage: "/qpay.png",
      });
    }

    return NextResponse.json({
      paymentId: String(payment._id),
      amount: payment.amount,
      referenceCode: payment.referenceCode,
      qr: "/qpay.png",
      bank: BANK,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
