import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { crosspostFeedPost } from "@/lib/feedCrosspost";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import type { Types } from "mongoose";
import Circle from "@/models/Circle";
import CircleMember from "@/models/CircleMember";
import { broadcastSSE } from "@/lib/sseHub";
import Task from "@/models/Task";
import User from "@/models/User";
import Category from "@/models/Category";
import { broadcastNotification } from "@/lib/notifications";
import { awardXP } from "@/lib/xp";
import { isActiveMember, effectiveLevel, feedBand, accessState } from "@/lib/membership";
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
    const circle = searchParams.get("circle");

    const query: Record<string, unknown> = {};
    if (authorId) query.author = authorId;
    // Профайлын "Таалагдсан" таб (2026-10-11): тухайн хүний love дарсан постууд.
    const likedBy = searchParams.get("likedBy");
    if (likedBy && /^[a-f0-9]{24}$/i.test(likedBy)) query["reactions.love"] = likedBy;
    if (category === "reels") {
      // "Reels" is not a real post category — it's a feed filter that
      // selects any post with a short-form video attached, across every
      // category. Bypasses the default "бүтээл" hide because the user is
      // explicitly opting into video content.
      query.video = { $exists: true, $ne: "" };
    } else if (category && typeof category === "string" && category.length <= 50) {
      query.category = category;
    }
    /* Хүрээллийн урсгал. Заагаагүй үед НИЙТИЙН урсгал гарна —
       хүрээллийн постыг нийтэд урсгахгүйн тулд хоосныг нь шүүнэ. */
    if (circle) {
      query.circle = circle;
    } else {
      query.circle = { $in: ["", null] };
      /* 2026-10-11: reel-only дууссан — текст, зураг, карусель, видео бүгд
         урсгалд. `?kind=` нь төрлөөр шүүнэ (урсгалын табууд). */
    }
    const kind = searchParams.get("kind");
    const noVideo = { $in: ["", null] };
    if (kind === "video") query.video = { $exists: true, $nin: ["", null] };
    else if (kind === "image") Object.assign(query, { video: noVideo, $or: [{ "images.0": { $exists: true } }, { image: { $nin: ["", null] } }] });
    else if (kind === "text") Object.assign(query, { video: noVideo, "images.0": { $exists: false }, image: { $in: ["", null] } });
    // Default "Бүгд" feed now shows ALL categories (incl. "бүтээл" AI art) —
    // no category is excluded by default.

    /* ─── Хаалт: `members` пост нь ТӨЛБӨРТЭЙ гишүүнд л ─────────────────
       Өмнө нь энд "постууд зочин ч оруулаад бүгдэд нээлттэй" гэж бичээд
       үнэхээр тэгж ажилладаг байсан — `?visibility=` нь зүгээр л шүүлтүүр,
       хаалт биш. Өөрөөр хэлбэл гишүүдэд зориулсан бүх пост нэвтрээгүй хүнд
       ил байв. Хаалтыг ЭНД, серверт хийх ёстой: дэлгэц дээр таб нуих нь
       хаяг руу шууд орсон хүнийг зогсоохгүй.

       Эрхгүй хүн юу гуйсан ч `free`-ээс цааш харахгүй. Эрхтэй хүн `?visibility=`
       -ээр өөрөө сонгоно. */
    const viewerId = (session?.user as { id?: string } | undefined)?.id;
    const viewerIsAdmin = isAdmin(session?.user?.email);
    /* "Дагаж буй" урсгал (2026-10-11): зөвхөн дагасан хүмүүсийн пост. */
    if (searchParams.get("following") === "1") {
      const meDoc = viewerId ? await User.findById(viewerId).select("following").lean() : null;
      query.author = { $in: ((meDoc as { following?: unknown[] } | null)?.following || []) };
    }

    /* ─── 2026-08-26: ҮНЭГҮЙ УРСГАЛ БАЙХГҮЙ ───────────────────────────
       Өмнө нь эрхгүй хүн `visibility: "free"` постуудыг харж болдог байв.
       Одоо урсгал бүхэлдээ гишүүнчлэлийн цаана. Хоосон массив буцаах нь
       401 буцаахаас ДЭЭР: урсгалыг олон газраас (нүүр, профайл, хайлт)
       дууддаг тул алдаа шидвэл тэр бүх дэлгэц эвдэрнэ. Оронд нь
       `needsMembership` тугийг өгвөл UI өөрөө төлбөрийн хана үзүүлнэ. */
    /* 2026-10-06: зочинд урсгал нээгээд мөн өдөртөө БУЦААВ (зочны урсгал
       нүүрнээс хасагдсан) — эрхгүй хүнд урсгал хоосон хэвээр. */
    const access = await accessState(viewerId, session?.user?.email || null);
    if (!access.ok) {
      return NextResponse.json({
        posts: [],
        pagination: { page: 1, pages: 0, total: 0, limit },
        needsMembership: true,
      });
    }

    const canSeeMembers = true; // энд ирсэн бүхэн эрхтэй
    if (visibility === "free") {
      query.visibility = "free";
    } else if (visibility === "members") {
      query.visibility = "members";
    }

    // ─── Level-gated feed visibility ───
    // Applies only to members-visibility posts (free posts remain public to all).
    // Browsing a specific author (authorId) skips the gate — profile view stays coherent.
    const settings = await getAllLevelSettings();
    const userId = viewerId;
    const isAdminUser = viewerIsAdmin;

    if (
      settings.enabled &&
      !isAdminUser &&
      !authorId &&
      session?.user &&
      userId
    ) {
      const me = await User.findById(userId).select("level subscriptionExpiresAt").lean();
      const myLevel = (me as unknown as { level?: number } | null)?.level || 1;
      const paid = canSeeMembers;
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
        /* Тогтоосон пост эхэнд. Хоёрдугаар түлхүүр нь createdAt хэвээр тул
           тогтоосон нь олон байвал тэдгээр нь бас шинэ нь дээрээ эрэмбэлэгдэнэ.
           Хуудаслалт эвдрэхгүй: эрэмбэ тогтвортой, `skip` нь ижил дараалал
           дээр ажиллана. */
        .sort({ pinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name username avatar level")
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

    const { content, image, images, visibility, category, taskId, aiPrompt, video, videoDurationSec, circle, crosspost, aspect, textStyle, fileUrl, fileName, fileSize } = await req.json();

    const hasContent = content && content.trim().length > 0;
    // Accept new `images[]` (multi) or legacy single `image`. Either is enough.
    const rawImages: string[] = Array.isArray(images)
      ? images.filter((s) => typeof s === "string" && s.trim().length > 0)
      : (image && image.trim().length > 0 ? [image.trim()] : []);
    const hasImage = rawImages.length > 0;
    const hasVideo = typeof video === "string" && video.trim().length > 0;
    const hasFile = typeof fileUrl === "string" && /^\/uploads\/docs\/[0-9a-f-]{36}\.pdf$/.test(fileUrl);
    if (!hasContent && !hasImage && !hasVideo && !hasFile) {
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

    /* Хэн юуг хаана нийтлэх вэ:
       · Админ — өөрөө сонгоно.
       · Төлбөртэй гишүүн — гишүүдийн урсгал руу.
       · Төлбөргүй хэрэглэгч — ҮНЭГҮЙ урсгал руу.

       Сүүлийнх нь чухал: өмнө нь БҮХ пост `members` болдог байсан тул
       төлбөргүй хүн бичсэн ч өөрийнхөө постыг харж чаддаггүй байв (гишүүд
       урсгал нь түүнд хаалттай). Өөрийн бичсэн зүйл нь алга болдог систем
       нь эвдэрсэн систем. Одоо тэдний пост нээлттэй урсгалд буух бөгөөд
       тэр урсгал ингэж л дүүрнэ. */
    const postVisibility =
      userIsAdmin && (visibility === "free" || visibility === "members")
        ? visibility
        : paid
          ? "members"
          : "free";

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
      aspect: ["1:1", "4:5", "16:9", "9:16"].includes(aspect) ? aspect : "",
      textStyle: textStyle === "card" && !safeImages.length && !hasVideo ? "card" : "",
    };

    /* ХҮРЭЭЛЛИЙН ПОСТ. Зөвхөн ГИШҮҮН тэр хүрээлэлд бичнэ — үгүй бол
       хэн ч дурын slug илгээж чужой хүрээлэлд пост хийх боломжтой.
       Байхгүй эсвэл гишүүн биш бол хүрээллийг ЧИМЭЭГҮЙ хаяхгүй,
       алдаа буцаана: пост нийтийн урсгалд ороод дуусах нь хүний
       хүсээгүй зүйл. */
    const rawCircle = typeof circle === "string" ? circle.trim().slice(0, 40) : "";
    if (rawCircle) {
      const circleDoc = await Circle.findOne({ slug: rawCircle, published: true }).select("_id").lean();
      if (!circleDoc) {
        return NextResponse.json({ error: "Хүрээлэл олдсонгүй" }, { status: 404 });
      }
      const isMember = await CircleMember.exists({
        circle: (circleDoc as unknown as { _id: Types.ObjectId })._id,
        user: userId,
      });
      if (!isMember) {
        return NextResponse.json({ error: "Эхлээд хүрээлэлд нэгдэнэ үү" }, { status: 403 });
      }
      postData.circle = rawCircle;
    }

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
      // Reel хэмжээ: ≤60с (+2с encode зөрүү). 2026-10-06; өмнө нь 20с.
      if (Number.isFinite(dur) && dur > 62) {
        return NextResponse.json({ error: "Видео 60 секундээс хэтрэх ёсгүй." }, { status: 400 });
      }
      postData.video = safeVideo;
      postData.videoDurationSec = Number.isFinite(dur) ? Math.max(0, Math.min(62, Math.round(dur))) : 0;
    }

    if (hasFile) {
      postData.fileUrl = fileUrl;
      postData.fileName = typeof fileName === "string" ? fileName.slice(0, 120) : "file.pdf";
      postData.fileSize = Number.isFinite(Number(fileSize)) ? Math.max(0, Math.round(Number(fileSize))) : 0;
    }

    // 2026-10-11: зураг + видео хамт ирвэл видео нь давамгайлна (нэг медиа).
    if (postData.video) { postData.images = []; postData.image = ""; }

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

    /* ─── ГАДААД СУВГУУД РУУ ДАВХАР ──────────────────────────────────
       Хариу ХҮЛЭЭХГҮЙ: Threads нь контейнер бэлэн болохыг хүлээдэг,
       Instagram нь зургийг өөрөө татаж авдаг — хоёулаа хэдэн секунд.
       Тэрийг хүлээвэл сайт дээрх "Нийтлэх" товч гацсан мэт болно.
       Үр дүн нь `SocialPost` бичлэг болж /admin/social дээр харагдана,
       тиймээс алдаа чимээгүй алга болохгүй.

       ХОЁР ХААЛТ:
       · `visibility === "members"` — төлбөртэй контентыг Facebook дээр
         үнэгүй тараавал гишүүнчлэл өөрөө утгагүй болно.
       · хүрээллийн пост — зөвхөн тэр хүрээлэлд зориулагдсан.
       Админаас өөр хүн нийтлэхэд ч явахгүй: эдгээр нь брэндийн хаягууд. */
    /* 2026-10-09: composer нь админд СУВАГ СОНГУУЛНА (`crosspost: ["instagram",
       "facebook", …]`). Тодорхой сонголт нь "members" хаалтыг давна — эзэн
       өөрөө хуваалцахаар шийдсэн. Хуучин хэлбэр (true/undefined) хэвээр:
       members пост гадагш явахгүй. Энэ хаалтаас болж feed-ийн давхар
       нийтлэлт НЭГ Ч удаа ажиллаж байгаагүй (бүх пост "members"). */
    const xpPlatforms = Array.isArray(crosspost)
      ? (crosspost as unknown[]).filter((p): p is "facebook" | "instagram" | "threads" => p === "facebook" || p === "instagram" || p === "threads")
      : null;
    if (
      userIsAdmin &&
      !postData.circle &&
      (xpPlatforms ? xpPlatforms.length > 0 : crosspost !== false && postVisibility !== "members")
    ) {
      void crosspostFeedPost({
        postId: String(post._id),
        content: typeof content === "string" ? content : "",
        images: rawImages,
        video: typeof video === "string" ? video : "",
        byEmail: session.user.email || "",
        platforms: xpPlatforms ?? undefined,
      }).catch((e) => console.error("[crosspost]", e));
    }

    const populated = await post.populate("author", "name avatar");

    // Base XP for creating post
    let totalXP = 50;
    let taskAward: Awaited<ReturnType<typeof awardXP>> = null;

    // If task linked, complete the task and award task XP
    if (linkedTask) {
      linkedTask.assignedTo = userId as any;
      linkedTask.status = "submitted";
      linkedTask.submissionNote = `Post: /posts/${post._id}`;
      await linkedTask.save();
      totalXP += linkedTask.xpReward;
      taskAward = await awardXP(userId, "COMPLETE_TASK", linkedTask.xpReward, linkedTask._id.toString()).catch(() => null);
    }

    /* ХҮЛЭЭЖ авдаг болов (өмнө нь fire-and-forget байсан). Шалтгаан: клиент
       "+50 XP" гэдгийг ХАРИУНААС л мэднэ. Дахин дуудлага хийж мэдэх бол
       нэг постонд хоёр дугуй болно, таамаглаж хэвлэх бол үржүүлэгчийг
       (төлбөрт гишүүд өөр коэффициенттэй) буруу тооцно. Хоёр DB үйлдэл нь
       нэг сүлжээний дугуйгаас хамаагүй хямд. */
    const postAward = await awardXP(userId, "CREATE_POST", 50, post._id.toString()).catch(() => null);
    const xp =
      postAward || taskAward
        ? {
            awarded: (postAward?.awarded || 0) + (taskAward?.awarded || 0),
            total: postAward?.xp ?? taskAward?.xp ?? 0,
            level: postAward?.level ?? taskAward?.level ?? 1,
            leveledUp: !!(postAward?.leveledUp || taskAward?.leveledUp),
          }
        : null;

    broadcastNotification({
      type: "new_post",
      title: "Шинэ нийтлэл",
      message: `${session.user.name || "Хэн нэгэн"} шинэ пост нийтэллээ`,
      link: `/posts/${post._id}`,
      excludeUserId: userId,
    }).catch(() => {});

    // Realtime fan-out — every authed connected client gets the new post
    try { broadcastSSE("post-created", { post: populated }); } catch { /* non-fatal */ }
    return NextResponse.json({ post: populated, xp }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Posts feed is user-personalized and read-fresh — no static caching.
export const dynamic = "force-dynamic";
