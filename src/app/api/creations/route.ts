import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isActiveMember } from "@/lib/membership";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

/* ─── Бүтээлийн хана ──────────────────────────────────────────────────────

   Гишүүдийн ЗУРАГТАЙ / ВИДЕОТОЙ постуудыг нэг ханан дээр цуглуулна. Урсгал
   (`/api/posts`) нь ЯРИА — цаг хугацааны дараалал, текст голлоно. Энэ нь
   БҮТЭЭЛ — хийсэн зүйлийн нотолгоо. Хоёр өөр зорилго, хоёр өөр төгсгөл.

   ─── ХААЛТ ─────────────────────────────────────────────────────────────
   `visibility: "members"` пост нь `/api/posts` дээр эрхгүй хүнд ОГТ
   харагддаггүй. Энд өөр: хана нь МАРКЕТИНГИЙН гадаргуу тул хаалттай
   бүтээл нь "энд юм байна, гэхдээ дотор нь орох хэрэгтэй" гэж хэлэх
   ЁСТОЙ. Гэхдээ ЮУГ ЧУХАМ хэлэх нь чанд хязгаартай:

     ГАРНА   — зохиогчийн нэр, аватар, ангилал, огноо, "хаалттай" тэмдэг
     ГАРАХГҮЙ — зураг/видеоны ХАЯГ, текст, AI промпт, лайкийн тоо

   Зургийн ХАЯГ нь өөрөө агуулга: `/uploads/*` нь статик тул хаяг мэдсэн
   хүн шууд нээнэ. Тиймээс "бүдгэрүүлээд харуулъя" гэдэг нь хамгаалалт
   БИШ — зөвхөн хаягийг нь ОГТ ИЛГЭЭХГҮЙ байх нь хамгаалалт.

   Хэрэв хаалттай бүтээлийг зочинд огт үзүүлэхгүй байх нь зөв гэж үзвэл
   доорх тугийг `false` болго — өөр юу ч засах шаардлагагүй. */
const SHOW_LOCKED_TO_GUESTS = true;

const MEDIA_OR: Record<string, unknown>[] = [
  { image: { $exists: true, $nin: ["", null] } },
  { images: { $exists: true, $not: { $size: 0 } } },
  { video: { $exists: true, $nin: ["", null] } },
];

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const viewerId = (session?.user as { id?: string } | undefined)?.id;
    const canSeeMembers =
      isAdmin(session?.user?.email) ||
      (!!viewerId && (await isActiveMember(viewerId, session?.user?.email)));

    const sp = req.nextUrl.searchParams;
    const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 24));
    const cursor = sp.get("cursor"); // ISO огноо — үүнээс ХУУЧИН нь
    const author = sp.get("author");

    const and: Record<string, unknown>[] = [{ $or: MEDIA_OR }];
    if (cursor) {
      const c = new Date(cursor);
      if (!Number.isNaN(c.getTime())) and.push({ createdAt: { $lt: c } });
    }
    if (author && /^[a-f0-9]{24}$/i.test(author)) and.push({ author });
    if (!canSeeMembers && !SHOW_LOCKED_TO_GUESTS) and.push({ visibility: "free" });

    /* `Record<string, unknown>` нь энэ кодын баазад Mongoose-ийн шүүлтүүрт
       хэрэглэгддэг хэлбэр (`/api/posts` мөн адил) — шууд объект литерал
       дамжуулбал lean-ийн төрөлтэй мөргөлдөнө. */
    const filter: Record<string, unknown> = { $and: and };

    const rows = await Post.find(filter)
      .select("content image images video videoDurationSec category agentSlug visibility likes commentsCount createdAt author")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("author", "name avatar")
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const items = page.map((p) => {
      const r = p as unknown as {
        _id: unknown;
        content?: string;
        image?: string;
        images?: string[];
        video?: string;
        videoDurationSec?: number;
        category?: string;
        agentSlug?: string;
        visibility?: string;
        likes?: unknown[];
        commentsCount?: number;
        createdAt: Date;
        author?: { _id?: unknown; name?: string; avatar?: string };
      };

      const locked = r.visibility === "members" && !canSeeMembers;
      const base = {
        _id: String(r._id),
        locked,
        category: r.category || "",
        createdAt: r.createdAt,
        author: {
          _id: r.author?._id ? String(r.author._id) : "",
          name: r.author?.name || "Гишүүн",
          avatar: r.author?.avatar || "",
        },
      };

      if (locked) return base; // хаяг ч, текст ч, тоо ч байхгүй

      const images = Array.isArray(r.images) && r.images.length
        ? r.images
        : r.image
          ? [r.image]
          : [];

      return {
        ...base,
        content: (r.content || "").slice(0, 240),
        images,
        video: r.video || "",
        videoDurationSec: r.videoDurationSec || 0,
        agentSlug: r.agentSlug || "",
        likes: Array.isArray(r.likes) ? r.likes.length : 0,
        comments: r.commentsCount || 0,
      };
    });

    const anyMedia: Record<string, unknown> = { $or: MEDIA_OR };
    const lockedFilter: Record<string, unknown> = {
      $and: [{ $or: MEDIA_OR }, { visibility: "members" }],
    };
    const [total, lockedTotal] = await Promise.all([
      Post.countDocuments(anyMedia),
      canSeeMembers ? Promise.resolve(0) : Post.countDocuments(lockedFilter),
    ]);

    return NextResponse.json({
      items,
      total,
      locked: lockedTotal,
      canSeeMembers,
      nextCursor: hasMore ? new Date(page[page.length - 1].createdAt).toISOString() : null,
    });
  } catch (e) {
    console.error("[creations]", e);
    return NextResponse.json({ items: [], total: 0, locked: 0, canSeeMembers: false, nextCursor: null });
  }
}
