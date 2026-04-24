import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redeemForMembership } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const { optionIndex } = await req.json();

    const result = await redeemForMembership(userId, Number(optionIndex));
    return NextResponse.json({
      balance: result.balance,
      expiresAt: result.expiresAt,
      daysAdded: result.daysAdded,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Redeem failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const dynamic = "force-dynamic";
