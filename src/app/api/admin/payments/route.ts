import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

// GET — list payments, filtered by status; prioritizes those with receipts.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

  await dbConnect();

  const query: Record<string, unknown> = {};
  if (status && ["pending", "paid", "failed"].includes(status)) query.status = status;

  const payments = await Payment.find(query)
    .sort({ receiptUploadedAt: -1, claimedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate("user", "name email avatar instagram phone subscriptionExpiresAt level clan")
    .lean();

  const [pendingCount, withReceiptCount] = await Promise.all([
    Payment.countDocuments({ status: "pending" }),
    Payment.countDocuments({ status: "pending", receiptImage: { $ne: "" } }),
  ]);

  return NextResponse.json({
    items: payments,
    counts: {
      pending: pendingCount,
      pendingWithReceipt: withReceiptCount,
    },
  });
}

export const dynamic = "force-dynamic";
