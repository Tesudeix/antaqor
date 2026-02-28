import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Comment from "@/models/Comment";
import Post from "@/models/Post";
import { awardXP } from "@/lib/xp";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const comments = await Comment.find({ post: id })
      .sort({ createdAt: -1 })
      .populate("author", "name avatar")
      .lean();

    return NextResponse.json({ comments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content } = await req.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    await dbConnect();
    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comment = await Comment.create({
      post: id,
      author: userId,
      content: content.trim(),
    });

    post.commentsCount += 1;
    await post.save();

    const populated = await comment.populate("author", "name avatar");

    awardXP(userId, "COMMENT", 10, comment._id.toString()).catch(() => {});

    return NextResponse.json({ comment: populated }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
