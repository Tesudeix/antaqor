import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import { broadcastNotification } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const authorId = searchParams.get("author");

    const query = authorId ? { author: authorId } : {};
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name avatar")
        .lean(),
      Post.countDocuments(query),
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, image } = await req.json();

    const hasContent = content && content.trim().length > 0;
    const hasImage = image && image.trim().length > 0;

    if (!hasContent && !hasImage) {
      return NextResponse.json(
        { error: "Post must have text or an image" },
        { status: 400 }
      );
    }

    await dbConnect();

    const userId = (session.user as { id: string }).id;

    const post = await Post.create({
      author: userId,
      content: hasContent ? content.trim() : "",
      image: hasImage ? image.trim() : "",
    });

    const populated = await post.populate("author", "name avatar");

    broadcastNotification({
      type: "new_post",
      title: "New Post",
      message: `${session.user.name || "Someone"} shared a new post`,
      link: `/posts/${post._id}`,
      excludeUserId: userId,
    }).catch(() => {});

    return NextResponse.json({ post: populated }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
