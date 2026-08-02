import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import { broadcastSSE } from "@/lib/sseHub";
import Task from "@/models/Task";
import User from "@/models/User";
import Category from "@/models/Category";
import { broadcastNotification } from "@/lib/notifications";
import { awardXP } from "@/lib/xp";
import { isActiveMember, effectiveLevel, feedBand } from "@/lib/membership";
import { getAllLevelSettings } from "@/lib/siteSettings";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { safeExternalUrl } from "@/lib/urlSafety";
import { moderateText } from "@/lib/moderation";

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
    if (category === "reels") {
      // "Reels" is not a real post category — it's a feed filter that
      // selects any post with a short-form video attached, across every
      // category. Bypasses the default "бүтээл" hide because the user is
      // explicitly opting into video content.
      query.video = { $exists: true, $ne: "" };
    } else if (category && typeof category === "string" && category.length <= 50) {
      query.category = category;
    }
    // Default "Бүгд" feed now shows ALL categories (incl. "бүтээл" AI art) —
    // no category is excluded by default.

    // Posts are publicly visible (free + members) to everyone, including guests.
    // Visibility filter still honored when explicitly requested via ?visibility=.
    if (visibility === "free") {
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

    // ─── Gate aiPrompt to paid members only ───
    // The image stays public, but the prompt is a member-only asset.
    // We still tell the client *whether* a prompt exists (`hasAiPrompt`) so
    // the locked UI can render. Admins always get the full prompt.
    let canSeePrompts = isAdminUser;
    if (!canSeePrompts && session?.user && userId) {
      canSeePrompts = await isActiveMember(userId, session.user.email);
    }
    type PostShape = { _id?: unknown; aiPrompt?: string; hasAiPrompt?: boolean; latestComment?: unknown };
    const cleanPosts = (posts as unknown as PostShape[]).map((p) => {
      const promptPresent = !!(p.aiPrompt && p.aiPrompt.trim());
      if (!canSeePrompts && promptPresent) {
        const stripped: PostShape = { ...p, hasAiPrompt: true };
        delete stripped.aiPrompt;
        return stripped;
      }
      if (promptPresent) {
        return { ...p, hasAiPrompt: true };
      }
      return p;
    });

    // ─── Attach latestComment per post ───
    // Single $in query for all visible post IDs; group in JS by post and pick
    // the newest. Cheap (<1ms for 20 posts) and avoids N+1.
    try {
      const postIds = cleanPosts.map((p: PostShape) => p._id).filter(Boolean);
      if (postIds.length > 0) {
        const Comment = (await import("@/models/Comment")).default;
        const allLatest = await Comment.find({ post: { $in: postIds as unknown as string[] } })
          .sort({ createdAt: -1 })
          .populate("author", "name avatar")
          .lean();
        const latestByPost = new Map<string, unknown>();
        for (const c of allLatest) {
          const pid = String((c as { post: unknown }).post);
          if (!latestByPost.has(pid)) latestByPost.set(pid, c);
        }
        for (const p of cleanPosts) {
          const c = latestByPost.get(String(p._id));
          if (c) (p as PostShape).latestComment = c;
        }
      }
    } catch {
      // Non-fatal — feed still renders without comment previews
    }

    return NextResponse.json({
      posts: cleanPosts,
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

    const { content, image, images, visibility, category, taskId, aiPrompt, video, videoDurationSec } = await req.json();

    const hasContent = content && content.trim().length > 0;
    // Accept new `images[]` (multi) or legacy single `image`. Either is enough.
    const rawImages: string[] = Array.isArray(images)
      ? images.filter((s) => typeof s === "string" && s.trim().length > 0)
      : (image && image.trim().length > 0 ? [image.trim()] : []);
    const hasImage = rawImages.length > 0;
    const hasVideo = typeof video === "string" && video.trim().length > 0;

    if (!hasContent && !hasImage && !hasVideo) {
      return NextResponse.json(
        { error: "Post must have text, an image, or a video" },
        { status: 400 }
      );
    }

    if (rawImages.length > 10) {
      return NextResponse.json(
        { error: "Хамгийн ихдээ 10 зураг" },
        { status: 400 }
      );
    }

    // Hard cap on content length defensively (schema allows 50,000 — long
    // prompts/agents land here as full files via the prompt-file UI).
    if (content && content.length > 50000) {
      return NextResponse.json({ error: "Пост 50,000 тэмдэгт хэтрэхгүй байх ёстой" }, { status: 400 });
    }

    // ─── Moderation gate (free OpenAI omni-moderation) ───
    // Only blocks on the hard-policy categories (kid-sexual, illicit-violent,
    // self-harm instructions). Soft flags pass through but get logged.
    if (hasContent) {
      const mod = await moderateText(content as string);
      if (!mod.ok) {
        console.warn("[posts] moderation blocked", mod.flaggedCategories);
        return NextResponse.json(
          { error: mod.reason || "Контент дүрэм зөрчиж байна." },
          { status: 400 }
        );
      }
      if (mod.flaggedCategories && mod.flaggedCategories.length > 0) {
        console.log("[posts] mod soft flag", mod.flaggedCategories);
      }
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

    // Validate category against the Category collection (admin-manageable).
    let postCategory = "пост";
    if (typeof category === "string" && category.trim().length > 0 && category.length <= 50) {
      const slug = category.trim();
      const exists = await Category.findOne({ $or: [{ slug }, { name: slug }] }).lean();
      postCategory = exists ? slug : "пост";
    }

    // Snapshot author's current level for fast feed-band filtering
    const authorLevel = author?.level || 1;

    // Validate every image URL: allow local /uploads paths OR safe external http(s) URLs.
    const safeImages: string[] = [];
    for (const raw of rawImages) {
      const trimmed = raw.trim();
      if (trimmed.startsWith("/uploads/")) {
        safeImages.push(trimmed);
      } else {
        const safe = safeExternalUrl(trimmed);
        if (!safe) {
          return NextResponse.json({ error: "Зургийн URL хүчингүй." }, { status: 400 });
        }
        safeImages.push(safe);
      }
    }

    const postData: Record<string, unknown> = {
      author: userId,
      authorLevel,
      content: hasContent ? content.trim() : "",
      // Keep `image` populated with the first image for back-compat with old clients.
      image: safeImages[0] || "",
      images: safeImages,
      visibility: postVisibility,
      category: postCategory,
    };

    // Optional AI prompt — gated to members on the read side.
    if (typeof aiPrompt === "string" && aiPrompt.trim().length > 0) {
      postData.aiPrompt = aiPrompt.trim().slice(0, 50000);
    }

    // Optional video. Server enforces the same 20s ceiling the client checks
    // (with a small encode-drift buffer) so a tampered client can't sneak past.
    if (hasVideo) {
      const safeVideo = safeExternalUrl(video.trim()) || (video.trim().startsWith("/uploads/") ? video.trim() : null);
      if (!safeVideo) {
        return NextResponse.json({ error: "Видео URL хүчингүй." }, { status: 400 });
      }
      const dur = Number(videoDurationSec);
      if (Number.isFinite(dur) && dur > 22) {
        return NextResponse.json({ error: "Видео 20 секундээс хэтрэх ёсгүй." }, { status: 400 });
      }
      postData.video = safeVideo;
      postData.videoDurationSec = Number.isFinite(dur) ? Math.max(0, Math.min(22, Math.round(dur))) : 0;
    }

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

    // Realtime fan-out — every authed connected client gets the new post
    try { broadcastSSE("post-created", { post: populated }); } catch { /* non-fatal */ }
    return NextResponse.json({ post: populated }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Posts feed is user-personalized and read-fresh — no static caching.
export const dynamic = "force-dynamic";
