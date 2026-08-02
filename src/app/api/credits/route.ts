import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";
import Referral from "@/models/Referral";
import { ensureReferralCode } from "@/lib/credits";
import { REDEEM_OPTIONS } from "@/lib/creditsConfig";

// GET — my credits dashboard payload
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();

    const code = await ensureReferralCode(userId);

    const user = await User.findById(userId).select("credits creditsLifetime referralCount").lean();
    const u = user as unknown as { credits: number; creditsLifetime: number; referralCount: number };

    const [history, referrals] = await Promise.all([
      CreditTx.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      Referral.find({ referrer: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("referee", "name avatar subscriptionExpiresAt")
        .lean(),
    ]);

    const referralsNormalized = (referrals as unknown as {
      referee: { _id: { toString(): string }; name: string; avatar?: string; subscriptionExpiresAt?: Date } | null;
      signupAt: Date;
      firstPaymentAt?: Date;
      awarded: { signup: boolean; firstPayment: boolean };
    }[]).map((r) => ({
      referee: r.referee
        ? {
            _id: r.referee._id.toString(),
            name: r.referee.name,
            avatar: r.referee.avatar,
            isPaid: !!(r.referee.subscriptionExpiresAt && new Date(r.referee.subscriptionExpiresAt) > new Date()),
          }
        : null,
      signupAt: r.signupAt,
      firstPaymentAt: r.firstPaymentAt,
      awarded: r.awarded,
    }));

    return NextResponse.json({
      balance: u?.credits || 0,
      lifetime: u?.creditsLifetime || 0,
      referralCount: u?.referralCount || 0,
      referralCode: code,
      history,
      referrals: referralsNormalized,
      redeemOptions: REDEEM_OPTIONS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
