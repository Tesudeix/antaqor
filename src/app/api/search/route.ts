import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import News from "@/models/News";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/* GET /api/search?q= — баруун баганын хайлт (2026-10-11).
   Хүмүүс (нэр / @username) + Magazine нийтлэл — хоёулаа нийтэд нээлттэй
   мэдээлэл; гишүүдийн постын агуулгыг хайхгүй. */
export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim().replace(/^@/, "").slice(0, 40);
  if (q.length < 2) return NextResponse.json({ people: [], articles: [] });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (!rateLimit(`search:${ip}`, { max: 60, windowMs: 60_000 }).ok) {
    return NextResponse.json({ people: [], articles: [] }, { status: 429 });
  }
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  await dbConnect();
  const [people, articles] = await Promise.all([
    User.find({ $or: [{ name: rx }, { username: rx }], banned: { $ne: true } })
      .select("name username avatar")
      .sort({ level: -1, createdAt: 1 })
      .limit(6)
      .lean(),
    News.find({ published: true, title: rx }).select("title slug category").sort({ publishedAt: -1 }).limit(4).lean(),
  ]);
  return NextResponse.json({
    people: people.map((u) => ({ _id: String(u._id), name: u.name, username: u.username || "", avatar: u.avatar || "" })),
    articles: articles.map((a) => ({ title: a.title, href: `/magazine/${encodeURIComponent(a.slug)}`, category: a.category })),
  });
}
