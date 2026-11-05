import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

/* ─── Нийтийн AI бүрэлдэхүүн — зочны нүүрэнд ─────────────────────────────
   Зочин Antaqor-ыг "AI хамтлаг" гэж уншихын тулд ЯРИА биш, БҮТЭЭЛ харах
   ёстой. Тайлбар нь хэдэн ч байсан нэг зураг төдий хэлдэггүй.

   ⚠ ПРОМПТЫГ ХЭЗЭЭ Ч БУЦААХГҮЙ. `post.aiPrompt` нь төлбөртэй гишүүдийн
   эрх (`PostCard`-ын түгжигдсэн хэсгийг үз). Энэ маршрут нэвтрэлт
   шаарддаггүй тул промпт энд гарвал төлбөрийн ханыг URL-ээр тойрч
   болно. Зөвхөн зураг, зохиогч, холбоос. Энэ нь бас ЗӨВ санал болголт:
   ажлыг нь харуулж, жороо нь нууна. */

export async function GET(req: NextRequest) {
  const limit = Math.min(24, Math.max(1, parseInt(new URL(req.url).searchParams.get("limit") || "12", 10) || 12));

  try {
    await dbConnect();
    const rows = await Post.find({
      aiPrompt: { $exists: true, $ne: "" },
      image: { $exists: true, $ne: "" },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "name avatar")
      .select("image author createdAt reactions likes")
      .lean();

    const items = (rows as unknown as {
      _id: { toString(): string };
      image: string;
      createdAt: Date;
      likes?: unknown[];
      reactions?: Record<string, unknown[]>;
      author?: { _id?: { toString(): string }; name?: string; avatar?: string } | null;
    }[]).map((p) => {
      let count = Array.isArray(p.likes) ? p.likes.length : 0;
      if (p.reactions) for (const list of Object.values(p.reactions)) count += Array.isArray(list) ? list.length : 0;
      return {
        _id: p._id.toString(),
        image: p.image,
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
