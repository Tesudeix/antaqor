import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";

// GET — public list of active clients, ordered.
export async function GET() {
  try {
    await dbConnect();
    const clients = await Client.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    return NextResponse.json({ clients });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load clients";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — admin creates a client.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { name, logo, description, url, order, active } = body || {};
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    await dbConnect();
    const client = await Client.create({
      name: String(name).trim(),
      logo: String(logo || "").trim(),
      description: String(description || "").trim(),
      url: String(url || "").trim(),
      order: typeof order === "number" ? order : 0,
      active: active !== false,
    });
    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create client";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
