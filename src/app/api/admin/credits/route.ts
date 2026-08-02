import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";
import Referral from "@/models/Referral";
import { adminAdjustCredits } from "@/lib/credits";

// GET — economy dashboard
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);

    const [
      creditsAgg,
      earnedTotal,
      spentTotal,
      earnedLast30,
      spentLast30,
      reasonBreakdown,
      topBalances,
      topEarners,
      referralStats,
      recentTx,
    ] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            totalCredits: { $sum: "$credits" },
            totalLifetime: { $sum: "$creditsLifetime" },
            users: { $sum: 1 },
          },
        },
      ]),
      CreditTx.aggregate([{ $match: { kind: "earn" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      CreditTx.aggregate([{ $match: { kind: "spend" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      CreditTx.aggregate([
        { $match: { kind: "earn", createdAt: { $gte: since30 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      CreditTx.aggregate([
        { $match: { kind: "spend", createdAt: { $gte: since30 } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      CreditTx.aggregate([
        { $group: { _id: { reason: "$reason", kind: "$kind" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      User.find({ credits: { $gt: 0 } })
        .sort({ credits: -1 })
        .limit(10)
        .select("name email credits creditsLifetime referralCount avatar")
        .lean(),
      User.find({ creditsLifetime: { $gt: 0 } })
        .sort({ creditsLifetime: -1 })
        .limit(10)
        .select("name email creditsLifetime referralCount avatar")
        .lean(),
      Referral.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            signupAwarded: { $sum: { $cond: ["$awarded.signup", 1, 0] } },
            firstPaymentAwarded: { $sum: { $cond: ["$awarded.firstPayment", 1, 0] } },
          },
        },
      ]),
      CreditTx.find({})
        .sort({ createdAt: -1 })
        .limit(25)
        .populate("user", "name email avatar")
        .lean(),
    ]);

    return NextResponse.json({
      summary: {
        circulating: creditsAgg[0]?.totalCredits || 0,
        lifetime: creditsAgg[0]?.totalLifetime || 0,
        activeUsers: creditsAgg[0]?.users || 0,
        earned: earnedTotal[0]?.total || 0,
        spent: spentTotal[0]?.total || 0,
        earned30d: earnedLast30[0]?.total || 0,
        spent30d: spentLast30[0]?.total || 0,
      },
      referrals: referralStats[0] || { total: 0, signupAwarded: 0, firstPaymentAwarded: 0 },
      reasonBreakdown,
      topBalances,
      topEarners,
      recentTx,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — manual credit adjust
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { userId, amount, note } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    const n = Number(amount);
    if (!Number.isFinite(n) || n === 0) return NextResponse.json({ error: "amount required" }, { status: 400 });
    const result = await adminAdjustCredits(String(userId), n, typeof note === "string" ? note : undefined);
    return NextResponse.json({ balance: result.balance });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
