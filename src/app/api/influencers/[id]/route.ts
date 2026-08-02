import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Influencer from "@/models/Influencer";
import mongoose from "mongoose";

const PUBLIC_FIELDS =
  "name handle slug avatar cover bio location niche tier platforms totalFollowers engagementRate tags rateFrom verified featured status order stats createdAt";

// GET — public single profile, resolved by slug OR ObjectId. Hidden profiles
// are only returned to admins.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const or: Record<string, unknown>[] = [{ slug: id.toLowerCase() }];
    if (mongoose.isValidObjectId(id)) or.push({ _id: id });

    const doc = await Influencer.findOne({ $or: or }).select(PUBLIC_FIELDS).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if ((doc as { status?: string }).status !== "active") {
      const session = await getServerSession(authOptions);
      if (!session?.user || !isAdmin(session.user.email)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ influencer: doc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load influencer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT — admin updates any subset of fields.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const b = await req.json();
    const u: Record<string, unknown> = {};

    if (typeof b.name === "string") u.name = b.name.trim();
    if (typeof b.handle === "string") u.handle = b.handle.trim().replace(/^@/, "");
    if (typeof b.avatar === "string") u.avatar = b.avatar.trim();
    if (typeof b.cover === "string") u.cover = b.cover.trim();
    if (typeof b.bio === "string") u.bio = b.bio.trim();
    if (typeof b.location === "string") u.location = b.location.trim();
    if (typeof b.niche === "string") u.niche = b.niche.trim();
    if (typeof b.tier === "string") u.tier = b.tier;
    if (Array.isArray(b.platforms)) {
      u.platforms = b.platforms
        .filter((p: { network?: string }) => p && p.network)
        .map((p: { network: string; url?: string; followers?: number }) => ({
          network: p.network,
          url: String(p.url || "").trim(),
          followers: Number(p.followers) || 0,
        }));
      // Re-derive reach when the admin didn't pin an explicit total.
      if (typeof b.totalFollowers !== "number" || !b.totalFollowers) {
        u.totalFollowers = (u.platforms as { followers: number }[]).reduce(
          (s, p) => s + (p.followers || 0),
          0
        );
      }
    }
    if (typeof b.totalFollowers === "number") u.totalFollowers = b.totalFollowers;
    if (typeof b.engagementRate === "number") u.engagementRate = b.engagementRate;
    if (Array.isArray(b.tags)) u.tags = b.tags.map((t: string) => String(t).trim()).filter(Boolean);
    if (typeof b.rateFrom === "number") u.rateFrom = b.rateFrom;
    if (typeof b.contactEmail === "string") u.contactEmail = b.contactEmail.trim();
    if (typeof b.contactPhone === "string") u.contactPhone = b.contactPhone.trim();
    if (typeof b.verified === "boolean") u.verified = b.verified;
    if (typeof b.featured === "boolean") u.featured = b.featured;
    if (typeof b.status === "string") u.status = b.status === "hidden" ? "hidden" : "active";
    if (typeof b.order === "number") u.order = b.order;

    await dbConnect();
    const doc = await Influencer.findByIdAndUpdate(id, u, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ influencer: doc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update influencer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — admin removes a profile.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await params;
    await dbConnect();
    const r = await Influencer.findByIdAndDelete(id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete influencer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
