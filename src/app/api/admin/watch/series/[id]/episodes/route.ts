import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Series from "@/models/Series";
import Episode from "@/models/Episode";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** `Series.episodeCount`-ыг бодит тоотой нь тэнцүүлнэ. */
async function syncCount(seriesId: string) {
  const n = await Episode.countDocuments({ series: seriesId });
  await Series.findByIdAndUpdate(seriesId, { $set: { episodeCount: n } });
  return n;
}

// POST — шинэ анги
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    await dbConnect();

    const series = await Series.findById(id).select("_id").lean();
    if (!series) return NextResponse.json({ error: "series_not_found" }, { status: 404 });

    /* Дугаар өгөөгүй бол хамгийн сүүлийнхийн дараах нь. Админ 60 анги
       нэмэхдээ дугаар бичих шаардлагагүй байх ёстой. */
    let number = Number(body?.number);
    if (!Number.isFinite(number) || number < 1) {
      const last = await Episode.findOne({ series: id }).sort({ number: -1 }).select("number").lean();
      number = ((last?.number as number) || 0) + 1;
    }
    if (await Episode.exists({ series: id, number })) {
      return NextResponse.json({ error: "number_taken", number }, { status: 409 });
    }

    const created = await Episode.create({
      series: id,
      number,
      title: String(body?.title || "").trim(),
      videoUrl: String(body?.videoUrl || ""),
      videoType: body?.videoType === "link" ? "link" : "upload",
      poster: String(body?.poster || ""),
      durationSec: Number(body?.durationSec) || 0,
      priceCoins: Number.isFinite(Number(body?.priceCoins)) ? Number(body.priceCoins) : 30,
      published: body?.published !== false,
    });
    const episodeCount = await syncCount(id);
    return NextResponse.json({ episode: created, episodeCount });
  } catch (e) {
    console.error("[admin/watch/episodes] create", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
