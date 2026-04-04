import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// Per-member price increments — each member raises the price individually
const INCREMENTS = [
  { upTo: 20, add: 500 },   // Members 1-20: +₮500 each
  { upTo: 50, add: 300 },   // Members 21-50: +₮300 each
  { upTo: 100, add: 200 },  // Members 51-100: +₮200 each
  { upTo: Infinity, add: 100 }, // Members 100+: +₮100 each
];

const BASE_PRICE = 9900;

function calculatePrice(members: number): number {
  let price = BASE_PRICE;
  let counted = 0;

  for (const tier of INCREMENTS) {
    const membersInTier = Math.min(members, tier.upTo) - counted;
    if (membersInTier <= 0) break;
    price += membersInTier * tier.add;
    counted += membersInTier;
  }

  return price;
}

function getCurrentIncrement(members: number): number {
  for (const tier of INCREMENTS) {
    if (members < tier.upTo) return tier.add;
  }
  return INCREMENTS[INCREMENTS.length - 1].add;
}

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const paidMembers = await User.countDocuments({
      subscriptionExpiresAt: { $gt: now },
    });

    const currentPrice = calculatePrice(paidMembers);
    const nextPrice = calculatePrice(paidMembers + 1);
    const increment = getCurrentIncrement(paidMembers);

    return NextResponse.json({
      paidMembers,
      basePrice: BASE_PRICE,
      currentPrice,
      nextPrice,
      increment,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch pricing" }, { status: 500 });
  }
}
