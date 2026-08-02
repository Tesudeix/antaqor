import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import YukiLocation from "@/models/YukiLocation";

export async function GET() {
  try {
    await dbConnect();
    const locations = await YukiLocation.find({ active: true }).sort({ order: 1 }).lean();
    return NextResponse.json({ locations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load locations";
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
    const location = await YukiLocation.create({
      slug: String(body.slug || "").trim().toLowerCase(),
      name: String(body.name || "").trim(),
      address: String(body.address || "").trim(),
      city: String(body.city || "Улаанбаатар"),
      district: String(body.district || ""),
      phone: String(body.phone || ""),
      image: String(body.image || ""),
      mapUrl: String(body.mapUrl || ""),
      order: Number(body.order) || 0,
    });
    return NextResponse.json({ location }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create location";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
