import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import YukiService from "@/models/YukiService";

export async function GET() {
  try {
    await dbConnect();
    const services = await YukiService.find({ active: true }).sort({ order: 1 }).lean();
    return NextResponse.json({ services });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load services";
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
    const service = await YukiService.create({
      slug: String(body.slug || "").trim().toLowerCase(),
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim(),
      durationMin: Number(body.durationMin) || 60,
      priceMnt: Number(body.priceMnt) || 0,
      image: String(body.image || ""),
      order: Number(body.order) || 0,
    });
    return NextResponse.json({ service }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create service";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
