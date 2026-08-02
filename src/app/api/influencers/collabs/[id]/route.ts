import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import InfluencerCollab from "@/models/InfluencerCollab";

const STATUSES = ["new", "contacted", "won", "closed"];

// PUT — admin updates status / adminNote on a brand lead.
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
    if (typeof b.status === "string" && STATUSES.includes(b.status)) u.status = b.status;
    if (typeof b.adminNote === "string") u.adminNote = b.adminNote.trim();
    await dbConnect();
    const doc = await InfluencerCollab.findByIdAndUpdate(id, u, { new: true }).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ collab: doc });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — admin removes a lead.
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
    const r = await InfluencerCollab.findByIdAndDelete(id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
