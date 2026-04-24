import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";

const VALID_CATEGORIES = ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"];

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || `story-${Date.now().toString(36)}`;
}

function estimateReadingMinutes(text: string): number {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

// GET — public, paginated news feed
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12")));
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");

    const query: Record<string, unknown> = { published: true };
    if (category && VALID_CATEGORIES.includes(category)) query.category = category;
    if (featured === "true") query.featured = true;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      News.find(query)
        .sort({ featured: -1, publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-content")
        .lean(),
      News.countDocuments(query),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch {
    return NextResponse.json({ items: [], pagination: { page: 1, limit: 12, total: 0, pages: 1 } });
  }
}

// POST — admin only, create news article
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const {
      title,
      excerpt,
      content,
      coverImage,
      category,
      tags,
      source,
      sourceUrl,
      authorName,
      authorAvatar,
      featured,
      slug: bodySlug,
      publishedAt,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    let slug = (bodySlug && slugify(bodySlug)) || slugify(title);

    // ensure slug uniqueness
    const exists = await News.findOne({ slug }).lean();
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const cat = VALID_CATEGORIES.includes(category) ? category : "AI";
    const text = [excerpt, content].filter(Boolean).join(" ");

    const news = await News.create({
      title: title.trim(),
      slug,
      excerpt: (excerpt || "").trim(),
      content: (content || "").trim(),
      coverImage: coverImage || "",
      category: cat,
      tags: Array.isArray(tags) ? tags.slice(0, 10).map((t: string) => String(t).trim()).filter(Boolean) : [],
      source: (source || "").trim(),
      sourceUrl: (sourceUrl || "").trim(),
      authorName: (authorName || "Antaqor").trim(),
      authorAvatar: authorAvatar || "",
      featured: !!featured,
      published: true,
      readingMinutes: estimateReadingMinutes(text),
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
    });

    return NextResponse.json({ news }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
