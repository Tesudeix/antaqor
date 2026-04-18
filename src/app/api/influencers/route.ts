import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Influencer from "@/models/Influencer";

// GET — list influencers (public: active only, admin: all)
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const category = req.nextUrl.searchParams.get("category");
    const all = req.nextUrl.searchParams.get("all");

    let filter: Record<string, unknown> = { status: "active" };

    // Admin can see all
    if (all === "true") {
      const session = await getServerSession(authOptions);
      if (session?.user && isAdmin(session.user.email)) {
        filter = {};
      }
    }

    if (category && category !== "all") filter.category = category;

    const influencers = await Influencer.find(filter)
      .sort({ featured: -1, order: 1, "stats.followers": -1 })
      .lean();

    const categories = await Influencer.distinct("category", { status: "active" });

    return NextResponse.json({ influencers, categories });
  } catch {
    return NextResponse.json({ influencers: [], categories: [] });
  }
}

// POST — create influencer (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await dbConnect();

    const influencer = await Influencer.create(body);
    return NextResponse.json({ influencer }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
