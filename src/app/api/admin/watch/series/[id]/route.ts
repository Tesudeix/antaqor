import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Series from "@/models/Series";
import Episode from "@/models/Episode";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// GET — нэг цуврал + ангиуд
export async function GET(_req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { id } = await params;
    await dbConnect();
    const series = await Series.findById(id).lean();
    if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const episodes = await Episode.find({ series: id }).sort({ number: 1 }).lean();
    return NextResponse.json({ series, episodes });
  } catch (e) {
    console.error("[admin/watch/series/:id] get", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PATCH — засах
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const set: Record<string, unknown> = {};
    /* Зөвхөн ИРСЭН талбарыг хөдөлгөнө. Бүтнээр нь дарвал админ нэг талбар
       засахад бусад нь өгөгдмөл рүү чимээгүй буцна. */
    for (const f of ["title", "synopsis", "poster", "still"] as const) {
      if (typeof body?.[f] === "string") set[f] = body[f].trim();
    }
    for (const f of ["freeEpisodes", "passPriceCoins", "passDays", "year", "featuredRank"] as const) {
      if (Number.isFinite(Number(body?.[f]))) set[f] = Number(body[f]);
    }
    if (typeof body?.published === "boolean") set.published = body.published;
    if (Array.isArray(body?.genres)) set.genres = body.genres.slice(0, 6).map(String);

    await dbConnect();
    const series = await Series.findByIdAndUpdate(id, { $set: set }, { new: true }).lean();
    if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ series });
  } catch (e) {
    console.error("[admin/watch/series/:id] patch", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE — цуврал + бүх анги
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { id } = await params;
    await dbConnect();
    /* Ангиудыг нь хамт устгана — эс бөгөөс эзэнгүй анги үлдэж, дараа нь
       populate хийхэд null болж хуудас унана. */
    await Episode.deleteMany({ series: id });
    await Series.findByIdAndDelete(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/watch/series/:id] delete", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
