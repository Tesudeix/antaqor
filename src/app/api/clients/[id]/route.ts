import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Client from "@/models/Client";

// PUT — admin updates a client. Pass any subset of editable fields.
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
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.logo === "string") update.logo = body.logo.trim();
    if (typeof body.description === "string") update.description = body.description.trim();
    if (typeof body.url === "string") update.url = body.url.trim();
    if (typeof body.order === "number") update.order = body.order;
    if (typeof body.active === "boolean") update.active = body.active;

    await dbConnect();
    const client = await Client.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ client });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update client";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — admin removes a client.
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
    const r = await Client.findByIdAndDelete(id);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete client";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
