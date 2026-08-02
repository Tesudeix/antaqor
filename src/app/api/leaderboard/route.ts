import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// GET — top runners by XP earned in the last 7 days (feed right-rail widget).
// Weekly, not lifetime, so the board resets and stays contestable.
export async function GET() {
  try {
    await dbConnect();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await User.aggregate([
      { $unwind: "$xpHistory" },
      { $match: { "xpHistory.date": { $gte: since } } },
      {
        $group: {
          _id: "$_id",
          weeklyXp: { $sum: "$xpHistory.amount" },
          name: { $first: "$name" },
          avatar: { $first: "$avatar" },
        },
      },
      { $match: { weeklyXp: { $gt: 0 } } },
      { $sort: { weeklyXp: -1 } },
      { $limit: 5 },
    ]);
    const leaders = rows.map((r) => ({
      _id: String(r._id),
      name: r.name || "Гишүүн",
      avatar: r.avatar || "",
      xp: r.weeklyXp,
    }));
    return NextResponse.json({ leaders });
  } catch {
    return NextResponse.json({ leaders: [] });
  }
}
