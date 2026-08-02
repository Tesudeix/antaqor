import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { findPackage, CREDIT_PACKAGES } from "@/lib/creditPackages";
import { generateUniqueRefCode } from "@/lib/paymentCode";

// GET — current user's pending credit purchase (most recent), if any.
// Also returns the catalog so the page is one round-trip.
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  await dbConnect();

  const pending = await Payment.findOne({
    user: userId,
    kind: "credits",
    status: "pending",
  }).sort({ createdAt: -1 }).lean();

  return NextResponse.json({
    packages: CREDIT_PACKAGES,
    pending: pending
      ? {
          paymentId: String((pending as { _id: unknown })._id),
          referenceCode: (pending as { referenceCode: string }).referenceCode,
          amount: (pending as { amount: number }).amount,
          credits: (pending as { creditAmount: number }).creditAmount,
          packageId: (pending as { packageId: string }).packageId,
          hasReceipt: !!(pending as { receiptImage: string }).receiptImage,
          createdAt: (pending as { createdAt: Date }).createdAt,
        }
      : null,
  });
}

// POST — start a credit purchase: create a pending Payment with kind="credits"
// Body: { packageId: "starter" | "popular" | "pro" }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const userEmail = session.user.email || "";

  const body = (await req.json().catch(() => ({}))) as { packageId?: string };
  const pkg = findPackage(body.packageId || "");
  if (!pkg) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  await dbConnect();

  // If the user already has a pending purchase for the SAME package, return it
  // so refresh / double-click doesn't spawn duplicates. Different package?
  // Cancel the prior pending one (set to failed) so the latest selection wins.
  const existing = await Payment.findOne({
    user: userId,
    kind: "credits",
    status: "pending",
  });
  if (existing) {
    if (existing.packageId === pkg.id && existing.amount === pkg.price) {
      if (!existing.referenceCode) {
        existing.referenceCode = await generateUniqueRefCode();
        await existing.save();
      }
      return NextResponse.json({
        paymentId: existing._id,
        referenceCode: existing.referenceCode,
        amount: existing.amount,
        credits: existing.creditAmount,
        packageId: existing.packageId,
        status: existing.status,
        hasReceipt: !!existing.receiptImage,
      });
    }
    existing.status = "failed";
    existing.adminNote = (existing.adminNote || "") + " [auto-cancelled: switched package]";
    await existing.save();
  }

  const referenceCode = await generateUniqueRefCode();
  const payment = await Payment.create({
    user: userId,
    invoiceId: `CRD-${Date.now()}`,
    senderCode: userEmail,
    referenceCode,
    amount: pkg.price,
    kind: "credits",
    creditAmount: pkg.credits,
    packageId: pkg.id,
    description: `Antaqor Credits · ${pkg.label} · ${pkg.credits}₵ · ${userEmail}`,
    status: "pending",
  });

  return NextResponse.json({
    paymentId: payment._id,
    referenceCode: payment.referenceCode,
    amount: payment.amount,
    credits: payment.creditAmount,
    packageId: payment.packageId,
    status: "pending",
    hasReceipt: false,
  });
}
