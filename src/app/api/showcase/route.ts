import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

// GET — recent visual posts (image OR video). Used by the MaximalistWall on
// the guest homepage. Returns images[], video, agentSlug, category so the
// client can render mixed media. PUBLIC — visible to all visitors.
//
// Note: this endpoint does NOT include `aiPrompt` (member-only field) — only
// the visual + author preview.

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(48, Number(req.nextUrl.searchParams.get("limit")) || 24);
    await dbConnect();

    const posts = await Post.aggregate([
      {
        $match: {
          $or: [
            { image: { $exists: true, $nin: ["", null] } },
            { images: { $exists: true, $not: { $size: 0 } } },
            { video: { $exists: true, $nin: ["", null] } },
          ],
        },
      },
      { $addFields: { likesCount: { $size: { $ifNull: ["$likes", []] } } } },
      // Recency-leaning, tie-broken by likes — keeps the wall fresh + good
      { $sort: { createdAt: -1, likesCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "author",
          foreignField: "_id",
          as: "author",
          pipeline: [{ $project: { name: 1, avatar: 1 } }],
        },
      },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          image: 1,
          images: 1,
          video: 1,
          videoDurationSec: 1,
          content: 1,
          category: 1,
          agentSlug: 1,
          createdAt: 1,
          likesCount: 1,
          author: 1,
        },
      },
    ]);

    return NextResponse.json({ posts });
  } catch (e) {
    console.error("[showcase]", e);
    return NextResponse.json({ posts: [] });
  }
}

export const dynamic = "force-dynamic";
