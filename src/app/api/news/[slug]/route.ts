import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";

const VALID_CATEGORIES = ["AI", "LLM", "Agents", "Research", "Бизнес", "Tool", "Монгол"];

// GET — public, fetch by slug, increments view counter
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await dbConnect();
    const { slug } = await params;

    const news = await News.findOneAndUpdate(
      { slug: slug.toLowerCase(), published: true },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const article = news as unknown as { category: string; _id: unknown; publishedAt: Date };
    const related = await News.find({
      published: true,
      _id: { $ne: article._id },
      category: article.category,
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select("-content")
      .lean();

    return NextResponse.json({ news, related });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — admin only, update
export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { slug } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};
    const fields = [
      "title",
      "excerpt",
      "content",
      "coverImage",
      "tags",
      "source",
      "sourceUrl",
      "authorName",
      "authorAvatar",
      "featured",
      "published",
    ];
    for (const f of fields) if (f in body) update[f] = body[f];
    if (body.category && VALID_CATEGORIES.includes(body.category)) update.category = body.category;
    if (body.publishedAt) update.publishedAt = new Date(body.publishedAt);

    const news = await News.findOneAndUpdate({ slug: slug.toLowerCase() }, update, { new: true });
    if (!news) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { slug } = await params;
    const result = await News.findOneAndDelete({ slug: slug.toLowerCase() });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
