import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LandingCard, { LANDING_CARD_ICONS } from "@/models/LandingCard";

// PUT — admin only, update card
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    if (body.icon && !LANDING_CARD_ICONS.includes(body.icon)) {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }

    // Whitelist updatable fields
    const update: Record<string, unknown> = {};
    if (typeof body.title === "string") update.title = body.title.trim();
    if (typeof body.description === "string") update.description = body.description.trim();
    if (typeof body.icon === "string") update.icon = body.icon;
    if (typeof body.order === "number") update.order = body.order;
    if (typeof body.enabled === "boolean") update.enabled = body.enabled;
    if (typeof body.ctaLabel === "string") update.ctaLabel = body.ctaLabel.trim();
    if (typeof body.ctaHref === "string") update.ctaHref = body.ctaHref.trim();

    const card = await LandingCard.findByIdAndUpdate(id, update, { new: true });
    if (!card) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ card });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — admin only
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    await LandingCard.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
