import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import CompanionKnowledge from "@/models/CompanionKnowledge";
import { invalidatePlatformContext } from "@/lib/companionContext";

async function guard() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email);
}

type Params = Promise<{ id: string }>;

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await dbConnect();
  const body = (await req.json().catch(() => ({}))) as {
    topic?: string;
    content?: string;
    weight?: number;
    active?: boolean;
  };
  const update: Record<string, unknown> = {};
  if (typeof body.topic === "string") update.topic = body.topic.trim().slice(0, 60);
  if (typeof body.content === "string") update.content = body.content.trim().slice(0, 500);
  if (typeof body.weight === "number") update.weight = Math.max(1, Math.min(10, Math.round(body.weight)));
  if (typeof body.active === "boolean") update.active = body.active;
  const fact = await CompanionKnowledge.findByIdAndUpdate(id, update, { new: true });
  if (!fact) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  invalidatePlatformContext();
  return NextResponse.json({ fact });
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await dbConnect();
  await CompanionKnowledge.findByIdAndDelete(id);
  invalidatePlatformContext();
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
