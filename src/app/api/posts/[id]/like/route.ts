import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import { awardXP } from "@/lib/xp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const likeIndex = post.likes.findIndex(
      (likeId) => likeId.toString() === userId
    );

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(userId as unknown as import("mongoose").Types.ObjectId);

      // Award XP to post author (skip self-likes)
      const authorId = post.author.toString();
      if (authorId !== userId) {
        awardXP(authorId, "RECEIVE_LIKE", 5, post._id.toString()).catch(() => {});
      }
    }

    await post.save();

    return NextResponse.json({
      likes: post.likes.length,
      liked: likeIndex === -1,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
