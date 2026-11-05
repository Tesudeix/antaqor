import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

/* ─── Нийтийн AI ВИДЕО — зочны нүүрэнд ───────────────────────────────────
   `/api/ai-gallery`-ийн видео хувилбар, яг тэр зарчмаар:

   ⚠ ПРОМПТЫГ ХЭЗЭЭ Ч БУЦААХГҮЙ. Энэ маршрут нэвтрэлт шаарддаггүй тул
   промпт энд гарвал төлбөрийн ханыг URL-ээр тойрч болно. Зөвхөн видео,
   зохиогч, холбоос.

   ЭХ СУРВАЛЖ НЬ ПОСТ, СТУДИЙН ТҮҮХ БИШ. `AiVideo` хүснэгт нь гишүүний
   ХУВИЙН ажлын дэвтэр — тэндээс шууд татвал хүн үүсгэсэн бүхнээ
   зөвшөөрөлгүйгээр нийтэлсэн болно. Пост нь харин гишүүн өөрөө
   "урсгалд нийтлэх" гэж дарсны үр дүн. Зөвшөөрөл нь тэр дарлаганд байна. */

export async function GET(req: NextRequest) {
  const limit = Math.min(24, Math.max(1, parseInt(new URL(req.url).searchParams.get("limit") || "8", 10) || 8));

  try {
    await dbConnect();
    const rows = await Post.find({ video: { $exists: true, $ne: "" } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "name avatar")
      .select("video image author createdAt reactions likes videoDurationSec")
      .lean();

    const items = (rows as unknown as {
      _id: { toString(): string };
      video: string;
      image?: string;
      videoDurationSec?: number;
      createdAt: Date;
      likes?: unknown[];
      reactions?: Record<string, unknown[]>;
      author?: { name?: string; avatar?: string } | null;
    }[]).map((p) => {
      let count = Array.isArray(p.likes) ? p.likes.length : 0;
      if (p.reactions) for (const list of Object.values(p.reactions)) count += Array.isArray(list) ? list.length : 0;
      return {
        _id: p._id.toString(),
        video: p.video,
        poster: p.image || "",
        seconds: p.videoDurationSec || 0,
        author: p.author?.name || "Гишүүн",
        avatar: p.author?.avatar || "",
        reactions: count,
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
    );
  } catch {
    // Зочны нүүр нэг хэсэг унасны улмаас бүхэлдээ эвдрэх ёсгүй.
    return NextResponse.json({ items: [] });
  }
}

export const dynamic = "force-dynamic";
