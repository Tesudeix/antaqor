import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import YukiStylist from "@/models/YukiStylist";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("service");
    const locationId = searchParams.get("location");
    await dbConnect();
    const q: Record<string, unknown> = { active: true };
    if (serviceId) q.services = serviceId;
    if (locationId) q.location = locationId;
    const stylists = await YukiStylist.find(q).sort({ order: 1 }).lean();
    return NextResponse.json({ stylists });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load stylists";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const body = await req.json();
    await dbConnect();
    const stylist = await YukiStylist.create({
      slug: String(body.slug || "").trim().toLowerCase(),
      name: String(body.name || "").trim(),
      role: String(body.role || ""),
      bio: String(body.bio || ""),
      avatar: String(body.avatar || ""),
      services: Array.isArray(body.services) ? body.services : [],
      weeklyHours: Array.isArray(body.weeklyHours) ? body.weeklyHours : undefined,
      order: Number(body.order) || 0,
    });
    return NextResponse.json({ stylist }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create stylist";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
