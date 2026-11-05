import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Series from "@/models/Series";
import Episode from "@/models/Episode";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ epId: string }> };

// PATCH — анги засах
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { epId } = await params;
    const body = await req.json().catch(() => ({}));
    await dbConnect();

    const current = await Episode.findById(epId).select("series number").lean();
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const set: Record<string, unknown> = {};
    for (const f of ["title", "videoUrl", "poster"] as const) {
      if (typeof body?.[f] === "string") set[f] = body[f].trim();
    }
    for (const f of ["durationSec", "priceCoins"] as const) {
      if (Number.isFinite(Number(body?.[f]))) set[f] = Number(body[f]);
    }
    if (body?.videoType === "link" || body?.videoType === "upload") set.videoType = body.videoType;
    if (typeof body?.published === "boolean") set.published = body.published;

    /* Дугаар солих нь ЭРЭМБИЙГ өөрчилнө — тиймээс давхцлыг урьдчилж
       шалгана, эс бөгөөс unique index дээр ойлгомжгүй алдаа буцна. */
    if (Number.isFinite(Number(body?.number))) {
      const n = Number(body.number);
      if (n !== current.number && (await Episode.exists({ series: current.series, number: n }))) {
        return NextResponse.json({ error: "number_taken", number: n }, { status: 409 });
      }
      set.number = n;
    }

    const episode = await Episode.findByIdAndUpdate(epId, { $set: set }, { new: true }).lean();
    return NextResponse.json({ episode });
  } catch (e) {
    console.error("[admin/watch/episode/:id] patch", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE — анги устгах
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { epId } = await params;
    await dbConnect();
    const ep = await Episode.findById(epId).select("series").lean();
    if (!ep) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await Episode.findByIdAndDelete(epId);
    const n = await Episode.countDocuments({ series: ep.series });
    await Series.findByIdAndUpdate(ep.series, { $set: { episodeCount: n } });
    return NextResponse.json({ ok: true, episodeCount: n });
  } catch (e) {
    console.error("[admin/watch/episode/:id] delete", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
