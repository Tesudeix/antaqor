import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { maybeAwardReferralPayment } from "@/lib/credits";
import { getWireIntentStatus, wireEnabled } from "@/lib/wire";

// GET — return the user's latest payment + subscription state.
// Polled by /pricing while waiting. When the payment has a Wire intent, the
// poll itself verifies Wire server-side and auto-approves on success — no
// admin action needed for instant payments.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ payment: null, isMember: false });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();

    const payment = (await Payment.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select(
        "status amount plan referenceCode receiptImage receiptUploadedAt claimedAt adminNote paidAt createdAt wireIntentId"
      )
      .lean()) as { [k: string]: unknown } | null;

    if (
      payment &&
      payment.status === "pending" &&
      typeof payment.wireIntentId === "string" &&
      payment.wireIntentId &&
      wireEnabled()
    ) {
      try {
        const wireStatus = await getWireIntentStatus(payment.wireIntentId);
        if (wireStatus === "succeeded") {
          // Same fulfillment as admin approve (membership branch, 30 days).
          const doc = await Payment.findById(payment._id);
          if (doc && doc.status === "pending") {
            doc.status = "paid";
            doc.paidAt = new Date();
            doc.adminNote = "Wire автомат баталгаажуулалт";
            await doc.save();

            const user = await User.findById(userId);
            if (user) {
              const now = new Date();
              const base =
                user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
                  ? new Date(user.subscriptionExpiresAt)
                  : now;
              const expiresAt = new Date(base);
              expiresAt.setDate(expiresAt.getDate() + (Number(doc.periodDays) || 30));
              user.subscriptionExpiresAt = expiresAt;
              user.plan =
                doc.plan === "builder" || doc.plan === "operator" ? doc.plan : "starter";
              if (!user.clan) user.clan = "antaqor";
              if (!user.clanJoinedAt) user.clanJoinedAt = now;
              await user.save();
              maybeAwardReferralPayment(String(user._id)).catch(() => {});
            }
          }
          payment.status = "paid";
          payment.paidAt = payment.paidAt ?? new Date();
        }
      } catch {
        // Wire unreachable — keep polling; bank transfer path still works.
      }
    }

    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ payment: null });
  }
}

export const dynamic = "force-dynamic";
