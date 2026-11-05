import dbConnect from "@/lib/mongodb";
import News from "@/models/News";

/* ─── Magazine — серверийн өгөгдөл (2026-10-11) ───────────────────────────
   Шинэ коллекц ҮҮСГЭЭГҮЙ: News-ийн өгөгдөл дээр суусан (cover, гарчиг,
   ангилал, агуулга, үзэлт, published, featured — бүгд байсан). /news
   хэвээр ажиллана; /magazine нь ижил нийтлэлийн сэтгүүл маягийн нүүр. */

export type MagArticle = {
  slug: string; title: string; excerpt: string; coverImage: string; category: string;
  views: number; readingMinutes: number; publishedAt: string; featured: boolean; authorName: string; content?: string;
};

function shape(o: Record<string, unknown>): MagArticle {
  return {
    slug: String(o.slug), title: String(o.title || ""), excerpt: String(o.excerpt || ""),
    coverImage: String(o.coverImage || ""), category: String(o.category || "AI"),
    views: Number(o.views || 0), readingMinutes: Number(o.readingMinutes || 1),
    publishedAt: new Date((o.publishedAt as Date) || (o.createdAt as Date) || Date.now()).toISOString(),
    featured: !!o.featured, authorName: String(o.authorName || "Antaqor"),
    ...(typeof o.content === "string" ? { content: o.content } : {}),
  };
}

export async function listMagazine(category?: string, limit = 40): Promise<MagArticle[]> {
  await dbConnect();
  const q: Record<string, unknown> = { published: true };
  if (category) q.category = category;
  const rows = await News.find(q).sort({ featured: -1, publishedAt: -1 }).limit(limit).select("-content").lean();
  return (rows as unknown as Record<string, unknown>[]).map(shape);
}

export async function getMagazineArticle(slug: string, increment: boolean): Promise<MagArticle | null> {
  await dbConnect();
  const s = decodeURIComponent(slug).toLowerCase();
  const row = increment
    ? await News.findOneAndUpdate({ slug: s, published: true }, { $inc: { views: 1 } }, { new: true }).lean()
    : await News.findOne({ slug: s, published: true }).lean();
  return row ? shape(row as unknown as Record<string, unknown>) : null;
}

export async function magazineCounts(): Promise<Record<string, number>> {
  await dbConnect();
  const rows = await News.aggregate([{ $match: { published: true } }, { $group: { _id: "$category", n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r: { _id: string; n: number }) => [r._id, r.n]));
}
