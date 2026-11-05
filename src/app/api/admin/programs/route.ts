import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Program from "@/models/Program";

/* ─── /api/admin/programs — хөтөлбөрийн CRUD ─────────────────────────── */

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) return null;
  return session;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const programs = await Program.find({}).sort({ order: 1 }).lean();
  return NextResponse.json({ programs });
}

type Body = {
  _id?: string;
  slug?: string;
  title?: string;
  code?: string;
  kicker?: string;
  audience?: string;
  scheduleDays?: string;
  scheduleTime?: string;
  summary?: string;
  lessonCount?: number;
  stats?: { value: string; label: string }[];
  takeaway?: string;
  bullets?: string[];
  accent?: string;
  order?: number;
  enabled?: boolean;
};

function clean(b: Body) {
  return {
    code: String(b.code ?? "").slice(0, 40),
    title: String(b.title ?? "").slice(0, 80),
    kicker: String(b.kicker ?? "").slice(0, 60),
    audience: String(b.audience ?? "").slice(0, 160),
    scheduleDays: String(b.scheduleDays ?? "").slice(0, 60),
    scheduleTime: String(b.scheduleTime ?? "").slice(0, 40),
    summary: String(b.summary ?? "").slice(0, 600),
    lessonCount: Math.max(0, Number(b.lessonCount) || 0),
    /* Сүлжээ нь 2×2 тул дөрөв. Илүүг нь таслахгүй бол админ санамсаргүй
       10 тоо оруулаад карт эвдэрнэ. */
    stats: (Array.isArray(b.stats) ? b.stats : []).slice(0, 4).map((s) => ({
      value: String(s?.value ?? "").slice(0, 24),
      label: String(s?.label ?? "").slice(0, 90),
    })),
    takeaway: String(b.takeaway ?? "").slice(0, 400),
    bullets: (Array.isArray(b.bullets) ? b.bullets : []).slice(0, 8).map((x) => String(x).slice(0, 180)),
    accent: /^#[0-9A-Fa-f]{6}$/.test(String(b.accent)) ? String(b.accent) : "#1F1AD9",
    order: Number(b.order) || 100,
    enabled: b.enabled !== false,
  };
}

export async function POST(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  const slug = String(b.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!slug || !b.title) return NextResponse.json({ error: "slug_and_title_required" }, { status: 400 });
  await dbConnect();
  if (await Program.findOne({ slug })) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }
  const created = await Program.create({ slug, ...clean(b) });
  return NextResponse.json({ ok: true, program: created });
}

export async function PATCH(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b._id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await dbConnect();
  /* `slug` ЗОРИУД өөрчлөгдөхгүй: хэрэглэгчийн `program` талбар түүгээр
     заадаг тул сольвол өмнө бүртгүүлсэн хүмүүсийн сонголт тасарна. */
  const row = await Program.findByIdAndUpdate(b._id, clean(b), { new: true });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, program: row });
}

export async function DELETE(req: NextRequest) {
  if (!(await guard())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  await dbConnect();
  await Program.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
