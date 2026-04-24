import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import Task from "@/models/Task";
import User from "@/models/User";
import { broadcastNotification } from "@/lib/notifications";
import { awardXP } from "@/lib/xp";
import { isActiveMember, effectiveLevel, feedBand } from "@/lib/membership";
import { getAllLevelSettings } from "@/lib/siteSettings";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { safeExternalUrl } from "@/lib/urlSafety";

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
    const validCategories = ["мэдээлэл", "ялалт", "промт", "бүтээл", "танилцуулга"];
    if (category && validCategories.includes(category)) query.category = category;

    // Non-authenticated users can only see free posts
    if (!session?.user) {
      query.visibility = "free";
    } else if (visibility === "free") {
      query.visibility = "free";
    } else if (visibility === "members") {
      query.visibility = "members";
    }

    // ─── Level-gated feed visibility ───
    // Applies only to members-visibility posts (free posts remain public to all).
    // Browsing a specific author (authorId) skips the gate — profile view stays coherent.
    const settings = await getAllLevelSettings();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const isAdminUser = isAdmin(session?.user?.email);

    if (
      settings.enabled &&
      !isAdminUser &&
      !authorId &&
      session?.user &&
      userId
    ) {
      const me = await User.findById(userId).select("level subscriptionExpiresAt").lean();
      const myLevel = (me as unknown as { level?: number } | null)?.level || 1;
      const paid = await isActiveMember(userId, session.user.email);
      const effLevel = effectiveLevel(myLevel, paid, settings.cap);
      const { lo, hi } = feedBand(effLevel, settings.band);

      // Apply the band constraint to members posts only — keep free posts visible
      // Missing authorLevel (legacy posts) falls through the gate until backfilled.
      const bandFilter = {
        $or: [
          { visibility: "free" },
          { authorLevel: { $gte: lo, $lte: hi } },
          { authorLevel: { $exists: false } },
        ],
      };

      if (query.$and) {
        (query.$and as unknown[]).push(bandFilter);
      } else {
        query.$and = [bandFilter];
      }
    }

    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name avatar level")
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

    // Hard cap on content length defensively (schema says 2000 — double-check at API)
    if (content && content.length > 2000) {
      return NextResponse.json({ error: "Пост хэт урт" }, { status: 400 });
    }

    await dbConnect();

    const userId = (session.user as { id: string }).id;
    const userIsAdmin = isAdmin(session.user.email);

    // Ban check
    const authorDoc = await User.findById(userId).select("level banned subscriptionExpiresAt").lean();
    const author = authorDoc as unknown as {
      level?: number;
      banned?: boolean;
      subscriptionExpiresAt?: Date;
    } | null;
    if (author?.banned && !userIsAdmin) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    // Post rate limit (tiered)
    const paid =
      userIsAdmin ||
      !!(author?.subscriptionExpiresAt && new Date(author.subscriptionExpiresAt) > new Date());
    if (!userIsAdmin) {
      const cfg = paid ? LIMITS.POST_PAID_PER_HOUR : LIMITS.POST_FREE_PER_HOUR;
      const rl = rateLimit(`post:${userId}`, cfg);
      if (!rl.ok) {
        const mins = Math.ceil(rl.resetInMs / 60_000);
        return NextResponse.json(
          {
            error: `Цагт ${cfg.max} пост хязгаартай. ~${mins} минутын дараа оролдоно уу.${paid ? "" : " Гишүүнчлэлтэй бол хязгаар илүү том."}`,
          },
          { status: 429 }
        );
      }
    }

    const postVisibility =
      userIsAdmin && (visibility === "free" || visibility === "members")
        ? visibility
        : "members";

    const validCats = ["мэдээлэл", "ялалт", "промт", "бүтээл", "танилцуулга"];
    const postCategory = (category && validCats.includes(category)) ? category : "мэдээлэл";

    // Snapshot author's current level for fast feed-band filtering
    const authorLevel = author?.level || 1;

    // Validate image URL: allow local /uploads paths OR safe external http(s) URLs only
    let safeImage = "";
    if (hasImage) {
      const trimmed = image.trim();
      if (trimmed.startsWith("/uploads/")) {
        safeImage = trimmed;
      } else {
        safeImage = safeExternalUrl(trimmed);
        if (!safeImage) {
          return NextResponse.json({ error: "Зургийн URL хүчингүй." }, { status: 400 });
        }
      }
    }

    const postData: Record<string, unknown> = {
      author: userId,
      authorLevel,
      content: hasContent ? content.trim() : "",
      image: safeImage,
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
