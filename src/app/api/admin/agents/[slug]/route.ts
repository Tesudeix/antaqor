import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Agent from "@/models/Agent";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { slug } = await params;
    const body = await req.json();

    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.description === "string") update.description = body.description;
    if (typeof body.avatar === "string") update.avatar = body.avatar;
    if (typeof body.cover === "string") update.cover = body.cover;
    if (typeof body.href === "string") update.href = body.href;
    if (typeof body.order === "number") update.order = body.order;

    await dbConnect();
    const agent = await Agent.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      { $set: update, $setOnInsert: { slug: slug.toLowerCase() } },
      { new: true, upsert: true }
    );
    return NextResponse.json({ agent });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update agent";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
