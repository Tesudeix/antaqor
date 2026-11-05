import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import News from "@/models/News";
import Category from "@/models/Category";

export const dynamic = "force-dynamic";

/* GET /api/rail — баруун баганын "Юу болж байна" + "Дагах хүмүүс" (2026-10-11).
   Юу болж байна: Magazine-ийн шинэ нийтлэл (нийтэд нээлттэй) + сүүлийн 14
   хоногийн хамгийн идэвхтэй ангиллууд (зөвхөн ТОО — гишүүдийн постын
   агуулга зочинд гарахгүй).
   Дагах хүмүүс: сүүлийн 90 хоногт хамгийн их нийтэлсэн гишүүд — өөрийгөө
   болон аль хэдийн дагасан хүмүүсээ хассан. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const me = (session?.user as { id?: string } | undefined)?.id || null;
  await dbConnect();

  const since14 = new Date(Date.now() - 14 * 86400e3);
  const since90 = new Date(Date.now() - 90 * 86400e3);

  const [news, cats, catDocs, meDoc, active] = await Promise.all([
    News.find({ published: true }).sort({ publishedAt: -1, createdAt: -1 }).limit(3).select("title slug category coverImage publishedAt createdAt views").lean(),
    Post.aggregate([
      { $match: { createdAt: { $gte: since14 }, circle: { $in: ["", null] } } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 3 },
    ]),
    Category.find({}).select("slug name").lean(),
    me ? User.findById(me).select("following").lean() : Promise.resolve(null),
    Post.aggregate([
      { $match: { createdAt: { $gte: since90 } } },
      { $group: { _id: "$author", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 25 },
    ]),
  ]);

  const catName = new Map(catDocs.map((c) => [String(c.slug), String(c.name || c.slug)]));
  /* 2026-10-11 v2: мэдээ тусдаа карт ("Өнөөдрийн мэдээ"), trend тусдаа. */
  const newsOut = news.map((a) => ({
    title: a.title,
    href: `/magazine/${encodeURIComponent(a.slug)}`,
    category: a.category || "AI",
    cover: a.coverImage || "",
    at: (a.publishedAt || a.createdAt || new Date()).toISOString(),
    views: a.views || 0,
  }));
  const trends = cats
    .filter((c) => c._id)
    .map((c) => ({ label: "Antaqor · Trending", title: `#${catName.get(String(c._id)) || c._id}`, meta: `${c.n} пост`, href: "/" }));

  const skip = new Set<string>([me || "", ...((meDoc as { following?: unknown[] } | null)?.following || []).map(String)]);
  const ids = active.map((a) => String(a._id)).filter((id) => id && !skip.has(id) && mongoose.Types.ObjectId.isValid(id));
  const users = await User.find({ _id: { $in: ids }, banned: { $ne: true } })
    .select("name username avatar subscriptionExpiresAt")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const now = Date.now();
  const suggest = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, 3)
    .map((u) => ({
      _id: String(u!._id),
      name: u!.name,
      username: u!.username || "",
      avatar: u!.avatar || "",
      member: !!u!.subscriptionExpiresAt && new Date(u!.subscriptionExpiresAt).getTime() > now,
    }));

  return NextResponse.json({ news: newsOut, trends, suggest });
}
