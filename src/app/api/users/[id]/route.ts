import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import mongoose from "mongoose";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    /* 2026-10-11: өмнө нь password-оос бусад БҮХ талбарыг хэнд ч буцаадаг
       байв (имэйл, утас, токен…). Одоо нийтийн талбар + эзэнд л хувийн. */
    const session = await getServerSession(authOptions);
    const viewerId = (session?.user as { id?: string } | undefined)?.id || null;
    const isSelf = viewerId === id;
    const PUBLIC = "name username avatar bio location website coverImage instagram facebook threads xp level subscriptionExpiresAt createdAt following";
    const user = await User.findById(id).select(isSelf ? `${PUBLIC} email phone age aiExperience interests` : PUBLIC).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    /* Профайлын TikTok маягийн мөр: Reels · Likes · Views — зөвхөн видеотой
       постуудаас (сайт reel-only болсон, 2026-10-06). Like = бүх reaction-ий
       нийлбэр (reactions нь { emoji: [userId] } хэлбэртэй). */
    let reelStats = { reels: 0, likes: 0, views: 0 };
    if (mongoose.Types.ObjectId.isValid(id)) {
      const [agg] = await Post.aggregate([
        { $match: { author: new mongoose.Types.ObjectId(id), video: { $exists: true, $nin: ["", null] }, circle: { $in: ["", null] } } },
        { $project: { viewsCount: 1, r: { $objectToArray: { $ifNull: ["$reactions", {}] } } } },
        { $project: { viewsCount: 1, l: { $sum: { $map: { input: "$r", as: "x", in: { $size: { $ifNull: ["$$x.v", []] } } } } } } },
        { $group: { _id: null, reels: { $sum: 1 }, likes: { $sum: "$l" }, views: { $sum: { $ifNull: ["$viewsCount", 0] } } } },
      ]);
      if (agg) reelStats = { reels: agg.reels, likes: agg.likes, views: agg.views };
    }

    const oid = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
    const [followersCount, postsCount, isFollowing] = oid
      ? await Promise.all([
          User.countDocuments({ following: oid }),
          Post.countDocuments({ author: oid, circle: { $in: ["", null] } }),
          viewerId && !isSelf ? User.exists({ _id: viewerId, following: oid }).then(Boolean) : Promise.resolve(false),
        ])
      : [0, 0, false];
    const { following, ...rest } = user as typeof user & { following?: unknown[] };
    return NextResponse.json({
      user: { ...rest, reelStats, followersCount, followingCount: (following || []).length, postsCount, isFollowing },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    if (userId !== id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, bio, avatar, phone, age, aiExperience, interests, instagram, facebook, threads, location, website, coverImage } =
      await req.json();

    await dbConnect();

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (location !== undefined) updateData.location = String(location).trim().slice(0, 60);
    if (website !== undefined) {
      // "vone.mn", "https://vone.mn/x" → хадгалахдаа протоколгүй; javascript: гэх мэтийг хаяна.
      const w = String(website).trim().replace(/^https?:\/\//i, "").slice(0, 120);
      updateData.website = /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(w) ? w : "";
    }
    if (coverImage !== undefined) {
      const c = String(coverImage).trim();
      updateData.coverImage = c === "" || /^\/uploads\/[\w.-]+$/.test(c) ? c : undefined;
      if (updateData.coverImage === undefined) delete updateData.coverImage;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (age !== undefined) updateData.age = age;
    if (aiExperience !== undefined) updateData.aiExperience = aiExperience;
    if (interests !== undefined) updateData.interests = interests;
    /* Хаяг оруулах бүх хэлбэрийг нэг болгоно: бүтэн URL, @-тай, эсвэл зүгээр
       нэр. Facebook нь цэг, зураас, тоо агуулж болох тул жижиг үсэг рүү
       хөрвүүлэхгүй — profile.php?id=… маягийн хаягийг эвдэхээс сэргийлж
       зөвхөн эхний замын хэсгийг авна. */
    const handle = (v: unknown, host: RegExp) =>
      String(v)
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(host, "")
        .replace(/^@+/, "")
        .split(/[/?#]/)[0]
        .slice(0, 60);

    if (instagram !== undefined) {
      updateData.instagram = handle(instagram, /^(www\.)?instagram\.com\//i).toLowerCase();
    }
    if (facebook !== undefined) {
      updateData.facebook = handle(facebook, /^(www\.|m\.|web\.)?facebook\.com\//i);
    }
    if (threads !== undefined) {
      updateData.threads = handle(threads, /^(www\.)?threads\.(net|com)\//i).toLowerCase();
    }

    const updated = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
