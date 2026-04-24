import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Testimonial from "@/models/Testimonial";
import { safeExternalUrl } from "@/lib/urlSafety";

// GET — public listing, sorted by featured/order/createdAt
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12")));

    // Admin can pass ?all=1 to see drafts too
    const session = await getServerSession(authOptions);
    const includeUnpublished = isAdmin(session?.user?.email) && searchParams.get("all") === "1";

    const query: Record<string, unknown> = includeUnpublished ? {} : { published: true };

    const items = await Testimonial.find(query)
      .sort({ featured: -1, order: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

// POST — admin create
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const {
      name, avatar, role, result, quote, tags, link, featured, published, order,
    } = body;

    if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (!result?.trim()) return NextResponse.json({ error: "Result required" }, { status: 400 });

    const cleanLink = link ? safeExternalUrl(link) : "";

    const created = await Testimonial.create({
      name: name.trim(),
      avatar: avatar || "",
      role: (role || "").trim(),
      result: result.trim(),
      quote: (quote || "").trim(),
      tags: Array.isArray(tags) ? tags.slice(0, 6).map((t: string) => String(t).trim()).filter(Boolean) : [],
      link: cleanLink,
      featured: !!featured,
      published: published === undefined ? true : !!published,
      order: Number.isFinite(Number(order)) ? Number(order) : 0,
    });

    return NextResponse.json({ testimonial: created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
