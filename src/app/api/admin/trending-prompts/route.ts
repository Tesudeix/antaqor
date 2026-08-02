import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import TrendingPrompt from "@/models/TrendingPrompt";

async function gateAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const block = await gateAdmin();
  if (block) return block;
  await dbConnect();
  const prompts = await TrendingPrompt.find().sort({ order: 1, createdAt: -1 }).lean();
  return NextResponse.json({ prompts });
}

export async function POST(req: NextRequest) {
  const block = await gateAdmin();
  if (block) return block;
  const body = await req.json().catch(() => ({}));
  const label = String(body.label || "").trim();
  const text = String(body.text || "").trim();
  if (!label || !text) {
    return NextResponse.json({ error: "label + text шаардлагатай" }, { status: 400 });
  }
  await dbConnect();
  const p = await TrendingPrompt.create({
    label: label.slice(0, 40),
    text: text,
    order: typeof body.order === "number" ? body.order : 0,
    active: body.active !== false,
  });
  return NextResponse.json({ prompt: p });
}

export async function PATCH(req: NextRequest) {
  const block = await gateAdmin();
  if (block) return block;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (typeof body.label === "string") update.label = body.label.trim().slice(0, 40);
  if (typeof body.text === "string") update.text = body.text.trim();
  if (typeof body.order === "number") update.order = body.order;
  if (typeof body.active === "boolean") update.active = body.active;
  await dbConnect();
  const p = await TrendingPrompt.findByIdAndUpdate(body.id, update, { new: true });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ prompt: p });
}

export async function DELETE(req: NextRequest) {
  const block = await gateAdmin();
  if (block) return block;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await dbConnect();
  await TrendingPrompt.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
