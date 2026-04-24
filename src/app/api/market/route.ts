import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";

const VALID_CATEGORIES = ["Prompt", "Course", "Template", "Agent", "Service", "Digital"] as const;
type Cat = (typeof VALID_CATEGORIES)[number];

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return base || `item-${Date.now().toString(36)}`;
}

// GET — public listing
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "24")));
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");
    const q = (searchParams.get("q") || "").trim();

    const query: Record<string, unknown> = { published: true, approved: true };
    if (category && VALID_CATEGORIES.includes(category as Cat)) query.category = category;
    if (featured === "true") query.featured = true;
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");
      query.$or = [{ title: rx }, { summary: rx }, { tags: rx }];
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      MarketProduct.find(query)
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-description")
        .lean(),
      MarketProduct.countDocuments(query),
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
    return NextResponse.json({ items: [], pagination: { page: 1, limit: 24, total: 0, pages: 1 } });
  }
}

// POST — admin seeds a product
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
      summary,
      description,
      coverImage,
      gallery,
      category,
      price,
      compareAtPrice,
      tags,
      sellerName,
      sellerAvatar,
      externalUrl,
      featured,
      slug: bodySlug,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

    let slug = (bodySlug && slugify(bodySlug)) || slugify(title);
    const exists = await MarketProduct.findOne({ slug }).lean();
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const cat: Cat = VALID_CATEGORIES.includes(category) ? category : "Prompt";

    const product = await MarketProduct.create({
      title: title.trim(),
      slug,
      summary: (summary || "").trim(),
      description: (description || "").trim(),
      coverImage: coverImage || "",
      gallery: Array.isArray(gallery) ? gallery.slice(0, 8) : [],
      category: cat,
      price: Math.max(0, Number(price) || 0),
      compareAtPrice: Math.max(0, Number(compareAtPrice) || 0),
      tags: Array.isArray(tags) ? tags.slice(0, 10).map((t: string) => String(t).trim()).filter(Boolean) : [],
      sellerName: (sellerName || "Antaqor").trim(),
      sellerAvatar: sellerAvatar || "",
      externalUrl: (externalUrl || "").trim(),
      featured: !!featured,
      approved: true,
      published: true,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
