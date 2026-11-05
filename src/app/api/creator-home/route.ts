import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import Post from "@/models/Post";
import { creatorProgram, CREATOR_PROGRAM_START, CREATOR_PROGRAM_END, CREATOR_SEATS } from "@/lib/creatorProgram";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await dbConnect();
    const now = new Date();
    const week = new Date(now.getTime() - 7 * 86400000);
    const ub = new Date(now.getTime() + 8 * 3600000);
    const today = new Date(Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate()) - 8 * 3600000);
    const real = { email: { $not: { $regex: "@antaqor\\.dm$", $options: "i" } } };
    const [total, joinedToday, active7d, paid, creators] = await Promise.all([
      User.countDocuments(real),
      User.countDocuments({ ...real, createdAt: { $gte: today } }),
      User.countDocuments({ ...real, xpHistory: { $elemMatch: { date: { $gte: week }, amount: { $gt: 0 } } } }),
      Payment.distinct("user", { kind: "membership", status: "paid", plan: "builder", createdAt: { $gte: new Date(CREATOR_PROGRAM_START), $lt: new Date(CREATOR_PROGRAM_END) } }),
      Post.aggregate([
        { $match: { agentSlug: { $in: ["", null] }, $or: [{ aiPrompt: { $exists: true, $ne: "" }, image: { $exists: true, $ne: "" } }, { video: { $exists: true, $ne: "" } }] } },
        { $addFields: { likeCount: { $size: { $setUnion: [{ $ifNull: ["$likes", []] }, []] } } } },
        { $sort: { likeCount: -1, createdAt: -1, _id: 1 } },
        { $group: { _id: "$author", likes: { $sum: "$likeCount" }, works: { $sum: 1 }, image: { $first: "$image" }, video: { $first: "$video" }, workId: { $first: "$_id" }, workLikes: { $first: "$likeCount" } } },
        { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "person", pipeline: [{ $project: { name: 1, avatar: 1 } }] } },
        { $unwind: "$person" },
        { $sort: { likes: -1, works: -1, _id: 1 } }, { $limit: 6 },
        { $project: { _id: 0, id: { $toString: "$_id" }, name: "$person.name", avatar: "$person.avatar", likes: 1, works: 1, image: 1, video: 1, workLikes: 1, workId: { $toString: "$workId" } } },
      ]),
    ]);
    return NextResponse.json({ stats: { total, joinedToday, active7d }, program: creatorProgram(now), seats: { total: CREATOR_SEATS, enrolled: paid.length, remaining: Math.max(0, CREATOR_SEATS - paid.length) }, creators }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
  } catch { return NextResponse.json({ error: "Мэдээллийг ачаалж чадсангүй" }, { status: 503 }); }
}
