import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

const FIXED_PRICE = 29000;

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const paidMembers = await User.countDocuments({
      subscriptionExpiresAt: { $gt: now },
    });

    return NextResponse.json({
      paidMembers,
      basePrice: FIXED_PRICE,
      currentPrice: FIXED_PRICE,
      nextPrice: FIXED_PRICE,
      increment: 0,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}
