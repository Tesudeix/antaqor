import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Circle from "@/models/Circle";
import CircleMember from "@/models/CircleMember";
import User from "@/models/User";
import type { Types } from "mongoose";

/* ─── /api/circles ─────────────────────────────────────────────────────
   GET  — жагсаалт (нэвтрэх шаардлагагүй, витрин)
   POST — нэгдэх / гарах (нэвтрэх шаардана) */

export const dynamic = "force-dynamic";

async function meId(email?: string | null): Promise<Types.ObjectId | null> {
  if (!email) return null;
  const u = await User.findOne({ email }).select("_id").lean();
  return u ? (u as unknown as { _id: Types.ObjectId })._id : null;
}

export async function GET() {
  await dbConnect();
  const rows = await Circle.find({ published: true }).sort({ order: -1, createdAt: 1 }).lean();

  /* Нэвтэрсэн бол аль хүрээлэлд нэгдсэнийг нь нэг query-гээр авна —
     карт тус бүрт шалгавал N+1 болно. */
  const session = await getServerSession(authOptions);
  const uid = await meId(session?.user?.email);
  const mine = uid
    ? new Set((await CircleMember.find({ user: uid }).select("circle").lean())
        .map((m) => String((m as { circle: unknown }).circle)))
    : new Set<string>();

  return NextResponse.json({
    circles: rows.map((c) => ({
      id: String(c._id), slug: c.slug, name: c.name, tagline: c.tagline,
      desc: c.desc, cover: c.cover, accent: c.accent,
      memberCount: c.memberCount, joined: mine.has(String(c._id)),
    })),
    loggedIn: !!uid,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Нэвтэрч байж хүрээлэлд нэгдэнэ" }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { slug?: string; action?: string };
  if (!b.slug) return NextResponse.json({ error: "slug шаардлагатай" }, { status: 400 });

  await dbConnect();
  const uid = await meId(session.user.email);
  if (!uid) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  const circle = await Circle.findOne({ slug: b.slug, published: true });
  if (!circle) return NextResponse.json({ error: "Хүрээлэл олдсонгүй" }, { status: 404 });

  if (b.action === "leave") {
    const r = await CircleMember.deleteOne({ circle: circle._id, user: uid });
    /* Тоолуурыг зөвхөн БОДИТООР устсан үед хөдөлгөнө — давхар дарахад
       тоо сөрөг рүү явахаас сэргийлнэ. */
    if (r.deletedCount) await Circle.updateOne({ _id: circle._id }, { $inc: { memberCount: -1 } });
    return NextResponse.json({ ok: true, joined: false });
  }

  try {
    await CircleMember.create({ circle: circle._id, user: uid });
    await Circle.updateOne({ _id: circle._id }, { $inc: { memberCount: 1 } });
  } catch (e) {
    /* Аль хэдийн гишүүн — алдаа биш, зүгээр л нэгдсэн төлөв. */
    if ((e as { code?: number }).code !== 11000) throw e;
  }
  return NextResponse.json({ ok: true, joined: true });
}
