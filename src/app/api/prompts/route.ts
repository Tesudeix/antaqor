import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PromptPost from "@/models/PromptPost";

export const dynamic = "force-dynamic";

// Нийтэд нээлттэй жагсаалт — share хийхэд нэвтрэлт шаардахгүй.
export async function GET(req: NextRequest) {
  await dbConnect();
  const category = req.nextUrl.searchParams.get("category") || "";
  const q: Record<string, unknown> = { published: true };
  if (category && category !== "all") q.category = category;

  const posts = await PromptPost.find(q)
    // Featured first, then newest — the Trending rail is just the top of this
    // same list, so a pack never appears twice with different data.
    .sort({ featured: -1, createdAt: -1 })
    .select("title slug description requiredPlan freeSlides slides copiesCount coverImage category featured tags creditPrice")
    .lean();

  const shape = (p: Record<string, unknown>) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    requiredPlan: p.requiredPlan,
    slideCount: (p.slides as unknown[]).length,
    freeSlides: p.freeSlides,
    copiesCount: p.copiesCount,
    coverImage: p.coverImage || "",
    category: p.category || "text",
    featured: Boolean(p.featured),
    tags: p.tags || [],
    creditPrice: Number(p.creditPrice || 0),
  });

  // Counts per category so the filter chips can show what is actually there
  // instead of offering an empty tab.
  const counts = await PromptPost.aggregate<{ _id: string; n: number }>([
    { $match: { published: true } },
    { $group: { _id: "$category", n: { $sum: 1 } } },
  ]);

  return NextResponse.json({
    posts: posts.map((p) => shape(p as unknown as Record<string, unknown>)),
    counts: Object.fromEntries(counts.map((c) => [c._id || "text", c.n])),
  });
}
