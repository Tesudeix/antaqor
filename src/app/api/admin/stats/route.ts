import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, totalMembers, totalPosts, recentSignups, aiLevelCounts, interestCounts, levelDistribution, topXPUsers] =
      await Promise.all([
        User.countDocuments(),
        User.countDocuments({ clan: { $ne: "" } }),
        Post.countDocuments(),
        User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
        User.aggregate([
          { $match: { aiExperience: { $ne: "" } } },
          { $group: { _id: "$aiExperience", count: { $sum: 1 } } },
        ]),
        User.aggregate([
          { $unwind: "$interests" },
          { $group: { _id: "$interests", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        User.aggregate([
          {
            $bucket: {
              groupBy: "$level",
              boundaries: [1, 11, 21, 41, 61, 91, 101],
              default: 1,
              output: { count: { $sum: 1 } },
            },
          },
        ]),
        User.find()
          .sort({ xp: -1 })
          .limit(10)
          .select("name avatar xp level")
          .lean(),
      ]);

    return NextResponse.json({
      totalUsers,
      totalMembers,
      totalPosts,
      recentSignups,
      aiLevelCounts,
      interestCounts,
      levelDistribution,
      topXPUsers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
