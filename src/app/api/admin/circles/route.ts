import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Circle from "@/models/Circle";
import CircleMember from "@/models/CircleMember";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const circles = await Circle.find({}).sort({ order: -1 }).lean();
  return NextResponse.json({ circles: circles.map((c) => ({ ...c, _id: String(c._id) })) });
}

const str = (v: unknown, m: number) => String(v ?? "").trim().slice(0, m);
function clean(b: Record<string, unknown>) {
  return {
    name: str(b.name, 60), tagline: str(b.tagline, 120), desc: str(b.desc, 1000),
    cover: str(b.cover, 300),
    accent: /^#[0-9A-Fa-f]{6}$/.test(String(b.accent)) ? String(b.accent) : "#2E29FF",
    published: b.published !== false, order: Number(b.order) || 0,
  };
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const slug = str(b.slug, 40).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!slug || !b.name) return NextResponse.json({ error: "slug ба нэр шаардлагатай" }, { status: 400 });
  await dbConnect();
  if (await Circle.findOne({ slug })) return NextResponse.json({ error: "slug давхардсан" }, { status: 409 });
  const row = await Circle.create({ slug, ...clean(b) });
  return NextResponse.json({ ok: true, id: String(row._id) });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b._id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await dbConnect();
  /* `slug` өөрчлөгдөхгүй — постууд түүгээр хамаардаг. */
  const row = await Circle.findByIdAndUpdate(String(b._id), clean(b), { new: true });
  if (!row) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await dbConnect();
  await CircleMember.deleteMany({ circle: id });
  await Circle.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
