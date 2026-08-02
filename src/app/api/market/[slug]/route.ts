import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";

const VALID_CATEGORIES = ["Prompt", "Course", "Template", "Agent", "Service", "Digital"];

// GET — public fetch (admin can load drafts)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await dbConnect();
    const { slug } = await params;
    const product = await MarketProduct.findOne({ slug: slug.toLowerCase() }).lean();
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — record an external click (anyone can trigger, rate-limited in awardCredits downstream if wired)
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await dbConnect();
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    const incField = body.action === "view" ? "views" : "clicks";
    const updated = await MarketProduct.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $inc: { [incField]: 1 } },
      { new: true }
    ).lean();

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — admin update
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
      "title", "summary", "description", "coverImage", "gallery", "tags",
      "sellerName", "sellerAvatar", "externalUrl", "featured", "published", "approved",
      "price", "compareAtPrice",
    ];
    for (const f of fields) if (f in body) update[f] = body[f];
    if (body.category && VALID_CATEGORIES.includes(body.category)) update.category = body.category;

    const product = await MarketProduct.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      update,
      { new: true }
    );
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — admin
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const { slug } = await params;
    const result = await MarketProduct.findOneAndDelete({ slug: slug.toLowerCase() });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
