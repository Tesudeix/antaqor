import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Service from "@/models/Service";

// GET — list all active services
export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category");

    await dbConnect();

    const filter: Record<string, unknown> = { status: { $ne: "inactive" } };
    if (category && category !== "all") filter.category = category;

    const services = await Service.find(filter)
      .sort({ featured: -1, order: 1, createdAt: -1 })
      .lean();

    // Get unique categories
    const categories = await Service.distinct("category", { status: { $ne: "inactive" } });

    return NextResponse.json({ services, categories });
  } catch {
    return NextResponse.json({ services: [], categories: [] });
  }
}

// POST — create a service (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await dbConnect();

    const service = await Service.create(body);
    return NextResponse.json({ service });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
