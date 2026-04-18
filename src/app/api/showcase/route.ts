import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

// GET — fetch latest posts with images (showcase / gallery)
export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit")) || 12;

    await dbConnect();

    const posts = await Post.find({
      image: { $ne: "" },
      visibility: "members",
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "name avatar xp level")
      .lean();

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ posts: [] });
  }
}

export const dynamic = "force-dynamic";
