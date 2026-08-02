import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  await dbConnect();

  const since30 = new Date(Date.now() - 30 * 864e5);

  const [agg, recentRaw] = await Promise.all([
    Payment.aggregate([
      {
        $group: {
          _id: { status: "$status", type: "$type" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Payment.find().sort({ createdAt: -1 }).limit(25).populate("user", "name email").lean(),
  ]);

  const paid30Agg = await Payment.aggregate([
    { $match: { status: "paid", createdAt: { $gte: since30 } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  let paidTotal = 0, paidCount = 0, pendingAmount = 0, pendingCount = 0, membershipPaid = 0, creditsPaid = 0;
  for (const g of agg) {
    if (g._id.status === "paid") {
      paidTotal += g.total; paidCount += g.count;
      if (g._id.type === "membership") membershipPaid += g.total;
      if (g._id.type === "credits") creditsPaid += g.total;
    } else if (g._id.status === "pending") {
      pendingAmount += g.total; pendingCount += g.count;
    }
  }

  const recent = recentRaw.map((p) => {
    const u = p.user as unknown as { name?: string; email?: string } | null;
    const pType = (p as unknown as { type?: string }).type || "membership";
    return {
      id: String(p._id),
      name: u?.name || u?.email || "—",
      type: pType,
      amount: p.amount || 0,
      status: p.status,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    };
  });

  return NextResponse.json({
    metrics: {
      paidTotal,
      paid30: paid30Agg[0]?.total || 0,
      paidCount,
      pendingAmount,
      pendingCount,
      membershipPaid,
      creditsPaid,
    },
    recent,
  });
}
