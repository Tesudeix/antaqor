import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import Task from "@/models/Task";
import { broadcastNotification } from "@/lib/notifications";
import { awardXP } from "@/lib/xp";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const authorId = searchParams.get("author");
    const visibility = searchParams.get("visibility");
    const category = searchParams.get("category");

    const query: Record<string, unknown> = {};
    if (authorId) query.author = authorId;
    if (category === "мэдээлэл" || category === "ялалт") query.category = category;

    // Non-authenticated users can only see free posts
    if (!session?.user) {
      query.visibility = "free";
    } else if (visibility === "free") {
      query.visibility = "free";
    } else if (visibility === "members") {
      query.visibility = "members";
    }

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

    const { content, image, visibility, category, taskId } = await req.json();

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
    const userIsAdmin = isAdmin(session.user.email);

    const postVisibility =
      userIsAdmin && (visibility === "free" || visibility === "members")
        ? visibility
        : "members";

    const postCategory = (category === "мэдээлэл" || category === "ялалт") ? category : "мэдээлэл";

    const postData: Record<string, unknown> = {
      author: userId,
      content: hasContent ? content.trim() : "",
      image: hasImage ? image.trim() : "",
      visibility: postVisibility,
      category: postCategory,
    };

    // Link to task if provided
    let linkedTask = null;
    if (taskId) {
      const task = await Task.findById(taskId);
      if (task && task.status === "open") {
        postData.taskId = taskId;
        linkedTask = task;
      }
    }

    const post = await Post.create(postData);

    const populated = await post.populate("author", "name avatar");

    // Base XP for creating post
    let totalXP = 50;

    // If task linked, complete the task and award task XP
    if (linkedTask) {
      linkedTask.assignedTo = userId as any;
      linkedTask.status = "submitted";
      linkedTask.submissionNote = `Post: /posts/${post._id}`;
      await linkedTask.save();
      totalXP += linkedTask.xpReward;
      awardXP(userId, "COMPLETE_TASK", linkedTask.xpReward, linkedTask._id.toString()).catch(() => {});
    }

    awardXP(userId, "CREATE_POST", 50, post._id.toString()).catch(() => {});

    broadcastNotification({
      type: "new_post",
      title: "Шинэ нийтлэл",
      message: `${session.user.name || "Хэн нэгэн"} шинэ пост нийтэллээ`,
      link: `/posts/${post._id}`,
      excludeUserId: userId,
    }).catch(() => {});

    return NextResponse.json({ post: populated }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
