import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import Payment from "@/models/Payment";

interface DayBucket {
  day: string;
  count: number;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    await dbConnect();

    const now = new Date();
    const thirty = new Date(now.getTime() - 30 * 86_400_000);

    // Run aggregations in parallel — same droplet, same Mongo, ~50ms total.
    const [
      totalUsers,
      members,
      totalPosts,
      signupsByDay,
      postsByDay,
      topCategoriesAgg,
      topCreatorsAgg,
      revenueAgg,
      revenue30Agg,
      reactionsTotalAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ subscriptionExpiresAt: { $gt: now } }),
      Post.countDocuments({}),
      User.aggregate<DayBucket>([
        { $match: { createdAt: { $gte: thirty } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: "$_id", count: 1 } },
      ]),
      Post.aggregate<DayBucket>([
        { $match: { createdAt: { $gte: thirty } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: "$_id", count: 1 } },
      ]),
      Post.aggregate<{ category: string; count: number }>([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { _id: 0, category: "$_id", count: 1 } },
      ]),
      Post.aggregate<{ _id: string; total: number; user?: { _id: string; name?: string; avatar?: string }[] }>([
        {
          $project: {
            author: 1,
            total: {
              $sum: {
                $map: {
                  input: { $objectToArray: { $ifNull: ["$reactions", {}] } },
                  as: "kv",
                  in: { $size: { $ifNull: ["$$kv.v", []] } },
                },
              },
            },
          },
        },
        { $group: { _id: "$author", total: { $sum: "$total" } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      ]),
      // All-time revenue from approved payments
      Payment.aggregate<{ total: number }>([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      // 30-day revenue
      Payment.aggregate<{ total: number }>([
        { $match: { status: "approved", createdAt: { $gte: thirty } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
        { $project: { _id: 0, total: 1 } },
      ]),
      // Total reactions across ALL posts (sum of every reactions[] length)
      Post.aggregate<{ total: number }>([
        {
          $project: {
            total: {
              $sum: {
                $map: {
                  input: { $objectToArray: { $ifNull: ["$reactions", {}] } },
                  as: "kv",
                  in: { $size: { $ifNull: ["$$kv.v", []] } },
                },
              },
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const topCreators = topCreatorsAgg.map((c) => {
      const u = c.user?.[0];
      return {
        _id: String(c._id),
        name: u?.name || "—",
        avatar: u?.avatar || "",
        reactions: c.total,
      };
    });

    return NextResponse.json({
      kpis: {
        totalUsers,
        members,
        totalPosts,
        totalReactions: reactionsTotalAgg[0]?.total || 0,
        revenueAll: revenueAgg[0]?.total || 0,
        revenue30: revenue30Agg[0]?.total || 0,
      },
      signupsByDay,
      postsByDay,
      topCategories: topCategoriesAgg,
      topCreators,
      gaConfigured: !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
      gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
