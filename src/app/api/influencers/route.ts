import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Influencer from "@/models/Influencer";

// Fields safe to expose publicly — contact info is intentionally omitted.
const PUBLIC_FIELDS =
  "name handle slug avatar cover bio location niche tier platforms totalFollowers engagementRate tags rateFrom verified featured status order stats createdAt";

function slugify(s: string) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// GET — public directory. Filters: ?niche= &tier= &platform= &q= &featured=1
// Admins may pass ?all=1 to include hidden profiles (with contact fields).
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const sp = req.nextUrl.searchParams;
    const wantAll = sp.get("all") === "1";

    let admin = false;
    if (wantAll) {
      const session = await getServerSession(authOptions);
      admin = !!session?.user && isAdmin(session.user.email);
    }

    const query: Record<string, unknown> = {};
    if (!admin) query.status = "active";

    const niche = sp.get("niche");
    if (niche && niche !== "all") query.niche = niche;

    const tier = sp.get("tier");
    if (tier && tier !== "all") query.tier = tier;

    const platform = sp.get("platform");
    if (platform && platform !== "all") query["platforms.network"] = platform;

    if (sp.get("featured") === "1") query.featured = true;

    const q = (sp.get("q") || "").trim();
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { handle: rx }, { niche: rx }, { tags: rx }];
    }

    const docs = await Influencer.find(query)
      .select(admin ? "" : PUBLIC_FIELDS)
      .sort({ featured: -1, order: 1, totalFollowers: -1 })
      .limit(200)
      .lean();

    // Facets for the filter bar — always over the full active set.
    const niches = await Influencer.distinct("niche", { status: "active", niche: { $ne: "" } });

    return NextResponse.json({ influencers: docs, niches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load influencers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — admin creates a roster entry.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const b = await req.json();
    const name = String(b.name || "").trim();
    if (!name) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 });

    await dbConnect();

    // Slug: use provided, else derive from handle/name; guarantee uniqueness.
    let base = slugify(b.slug || b.handle || name);
    if (!base) base = "creator";
    let slug = base;
    for (let i = 2; await Influencer.exists({ slug }); i++) slug = `${base}-${i}`;

    const platforms = Array.isArray(b.platforms)
      ? b.platforms
          .filter((p: { network?: string }) => p && p.network)
          .map((p: { network: string; url?: string; followers?: number }) => ({
            network: p.network,
            url: String(p.url || "").trim(),
            followers: Number(p.followers) || 0,
          }))
      : [];

    const derivedFollowers =
      Number(b.totalFollowers) ||
      platforms.reduce((s: number, p: { followers: number }) => s + (p.followers || 0), 0);

    const doc = await Influencer.create({
      name,
      handle: String(b.handle || "").trim().replace(/^@/, ""),
      slug,
      avatar: String(b.avatar || "").trim(),
      cover: String(b.cover || "").trim(),
      bio: String(b.bio || "").trim(),
      location: String(b.location || "").trim(),
      niche: String(b.niche || "").trim(),
      tier: b.tier || "micro",
      platforms,
      totalFollowers: derivedFollowers,
      engagementRate: Number(b.engagementRate) || 0,
      tags: Array.isArray(b.tags) ? b.tags.map((t: string) => String(t).trim()).filter(Boolean) : [],
      rateFrom: Number(b.rateFrom) || 0,
      contactEmail: String(b.contactEmail || "").trim(),
      contactPhone: String(b.contactPhone || "").trim(),
      verified: !!b.verified,
      featured: !!b.featured,
      status: b.status === "hidden" ? "hidden" : "active",
      order: Number(b.order) || 0,
    });

    return NextResponse.json({ influencer: doc }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create influencer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
