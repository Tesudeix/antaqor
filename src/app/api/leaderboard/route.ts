import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { leaderboardHiddenMatch } from "@/lib/leaderboardHidden";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET — top runners by XP earned in the last 7 days.
// Weekly, not lifetime, so the board resets and stays contestable.
//
// ?limit=N — 1..50, ӨГӨӨГҮЙ бол 5. Хуучин хэрэглэгч (/feed-ийн хажуугийн
// самбар) параметргүй дууддаг тул түүний зан байдал хөндөгдөхгүй; шинэ
// /leaderboard хуудас нь илүү урт жагсаалт гуйна.
export async function GET(req: Request) {
  try {
    // ЗААВАЛ null-ийг тусад нь шалгана: Number(null) === 0 бөгөөд тэр нь
    // finite тул шууд Number() хийвэл параметргүй дуудалт 5 биш 1 болж
    // хумигдана — /feed-ийн хажуугийн самбар нэг хүн харуулна.
    const q = new URL(req.url).searchParams.get("limit");
    const raw = q === null || q.trim() === "" ? NaN : Number(q);
    // 2026-10-06: дээд хязгаар 50 → 100 (/leaderboard топ 100 харуулна).
    const limit = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.trunc(raw))) : 5;
    /* `?me=1` — нэвтэрсэн хүний ӨӨРИЙН байр ("Та #2 байна"). Топ 100-аас
       гадна байсан ч олдоно, тиймээс энэ үед жагсаалтыг бүтнээр эрэмбэлнэ
       (~600 хэрэглэгч — хямд). Хажуугийн самбар me-гүй дууддаг тул тэнд
       нэмэлт ачаалал байхгүй. */
    const wantMe = new URL(req.url).searchParams.get("me") === "1";
    const session = wantMe ? await getServerSession(authOptions) : null;
    const meId = (session?.user as { id?: string } | undefined)?.id || null;

    await dbConnect();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await User.aggregate([
      leaderboardHiddenMatch,
      { $unwind: "$xpHistory" },
      { $match: { "xpHistory.date": { $gte: since } } },
      {
        $group: {
          _id: "$_id",
          weeklyXp: { $sum: "$xpHistory.amount" },
          name: { $first: "$name" },
          username: { $first: "$username" },
          avatar: { $first: "$avatar" },
        },
      },
      { $match: { weeklyXp: { $gt: 0 } } },
      { $sort: { weeklyXp: -1, _id: 1 } },
      ...(meId ? [] : [{ $limit: limit }]),
    ]);
    let me: { rank: number | null; xp: number; total: number } | null = null;
    if (meId) {
      const idx = rows.findIndex((r) => String(r._id) === meId);
      me = { rank: idx >= 0 ? idx + 1 : null, xp: idx >= 0 ? rows[idx].weeklyXp : 0, total: rows.length };
    }
    const leaders = rows.slice(0, limit).map((r) => ({
      _id: String(r._id),
      name: r.name || "Гишүүн",
      username: r.username || "",
      avatar: r.avatar || "",
      xp: r.weeklyXp,
    }));
    return NextResponse.json({ leaders, me });
  } catch {
    return NextResponse.json({ leaders: [] });
  }
}
