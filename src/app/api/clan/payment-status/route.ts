import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

// GET — return the user's latest payment + subscription state.
// Used by /clan page to poll status while waiting for admin approval.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ payment: null, isMember: false });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();

    const payment = await Payment.findOne({ user: userId })
      .sort({ createdAt: -1 })
      .select("status amount referenceCode receiptImage receiptUploadedAt claimedAt adminNote paidAt createdAt")
      .lean();

    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ payment: null });
  }
}

export const dynamic = "force-dynamic";
