import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import HeroSlide from "@/models/HeroSlide";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) return null;
  return session;
}

// ─── Hero слайд CRUD — зөвхөн админ ───
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const slides = await HeroSlide.find({}).sort({ order: 1, createdAt: 1 }).lean();
  return NextResponse.json({
    slides: slides.map((s) => ({
      id: String(s._id),
      order: s.order,
      chrome: s.chrome,
      line1: s.line1,
      line2: s.line2,
      sub: s.sub,
      ctaLabel: s.ctaLabel,
      ctaHref: s.ctaHref,
      image: s.image,
      active: s.active,
    })),
  });
}

interface SlideBody {
  id?: string;
  order?: number;
  chrome?: string;
  line1?: string;
  line2?: string;
  sub?: string;
  ctaLabel?: string;
  ctaHref?: string;
  image?: string;
  active?: boolean;
  layout?: string;
}

function pickFields(b: SlideBody) {
  const out: Record<string, unknown> = {};
  for (const k of ["order", "chrome", "line1", "line2", "sub", "ctaLabel", "ctaHref", "image", "active", "layout"] as const) {
    if (b[k] !== undefined) out[k] = b[k];
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as SlideBody | null;
  if (!b?.line1 || b.line1.trim().length < 2) {
    return NextResponse.json({ error: "line1_required" }, { status: 400 });
  }
  await dbConnect();
  const count = await HeroSlide.countDocuments({});
  const slide = await HeroSlide.create({ ...pickFields(b), line1: b.line1.trim(), order: b.order ?? count });
  return NextResponse.json({ ok: true, id: String(slide._id) });
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as SlideBody | null;
  if (!b?.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await dbConnect();
  await HeroSlide.updateOne({ _id: b.id }, { $set: pickFields(b) });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: string } | null;
  if (!b?.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await dbConnect();
  await HeroSlide.deleteOne({ _id: b.id });
  return NextResponse.json({ ok: true });
}
