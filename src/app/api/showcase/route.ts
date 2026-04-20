import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

// GET — fetch latest posts with images (showcase / gallery)
export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit")) || 12;

    await dbConnect();

    // Aggregate to sort by likes count (most liked first), then recent
    const posts = await Post.aggregate([
      { $match: { image: { $exists: true, $ne: "" } } },
      { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
      { $sort: { likesCount: -1, createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
          pipeline: [{ $project: { name: 1, avatar: 1, xp: 1, level: 1 } }],
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
    ]);

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}

export const dynamic = "force-dynamic";
