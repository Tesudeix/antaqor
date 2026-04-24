import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Testimonial from "@/models/Testimonial";
import { safeExternalUrl } from "@/lib/urlSafety";

type Params = Promise<{ id: string }>;

// PUT — admin update
export async function PUT(req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const k of ["name", "avatar", "role", "result", "quote", "featured", "published"]) {
      if (k in body) update[k] = body[k];
    }
    if ("order" in body && Number.isFinite(Number(body.order))) update.order = Number(body.order);
    if ("tags" in body && Array.isArray(body.tags)) {
      update.tags = body.tags.slice(0, 6).map((t: string) => String(t).trim()).filter(Boolean);
    }
    if ("link" in body) update.link = body.link ? safeExternalUrl(body.link) : "";

    const updated = await Testimonial.findByIdAndUpdate(id, update, { new: true });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ testimonial: updated });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — admin
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
    const res = await Testimonial.findByIdAndDelete(id);
    if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
