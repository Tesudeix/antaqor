import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { pushToAdmins } from "@/lib/push";

// POST — user attaches a receipt image (url obtained via /api/upload) to their pending Payment.
// Fires push to admins so approval happens in minutes, not hours.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const { receiptImage, paymentId } = await req.json();

    // Must be a local uploaded path — /api/upload only returns /uploads/*.webp
    if (typeof receiptImage !== "string" || !receiptImage.startsWith("/uploads/")) {
      return NextResponse.json({ error: "Receipt image required" }, { status: 400 });
    }

    await dbConnect();

    // Find the user's most-recent pending Payment (or the one they referenced)
    const query: Record<string, unknown> = { user: userId, status: "pending" };
    if (paymentId) query._id = paymentId;

    const payment = await Payment.findOne(query).sort({ createdAt: -1 });
    if (!payment) {
      return NextResponse.json({ error: "Pending payment not found" }, { status: 404 });
    }

    payment.receiptImage = receiptImage;
    payment.receiptUploadedAt = new Date();
    if (!payment.claimedAt) payment.claimedAt = new Date();
    await payment.save();

    // Fire push to every admin (non-blocking)
    const user = await User.findById(userId).select("name email instagram").lean();
    const u = user as unknown as { name?: string; email?: string; instagram?: string } | null;
    pushToAdmins({
      title: "Шинэ төлбөрийн баримт",
      body: `${u?.name || u?.email || "Хэрэглэгч"} · ₮${payment.amount.toLocaleString()} · ${payment.referenceCode}`,
      url: "/admin/payments",
      tag: `payment-${payment._id}`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      paymentId: payment._id,
      status: payment.status,
      hasReceipt: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
