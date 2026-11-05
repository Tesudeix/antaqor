import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Reel from "@/models/Reel";
import User from "@/models/User";

/* ─── /api/reels — клиентэд хийсэн AI видеоны тэжээл ───────────────────
   GET нь НЭВТРЭХ ШААРДЛАГАГҮЙ: эзэн үүнийг нийтийн уран бүтээлийн
   жагсаалт болгохоор шийдсэн тул холбоос хүлээн авсан клиент шууд
   ороод үзээд татна.

   DELETE нь өөрийн reel эсвэл админд л зөвшөөрөгдөнө. */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await dbConnect();
  const sp = req.nextUrl.searchParams;
  const client = (sp.get("client") || "").trim();
  const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 30));

  const q: Record<string, unknown> = { published: true };
  if (client) q.client = client;

  const rows = await Reel.find(q)
    .sort({ order: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json({
    reels: rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      client: r.client,
      caption: r.caption,
      videoUrl: r.videoUrl,
      thumbnail: r.thumbnail,
      durationSec: r.durationSec,
      views: r.views,
      downloads: r.downloads,
      uploaderName: r.uploaderName,
      createdAt: r.createdAt,
    })),
    /* Үйлчлүүлэгчийн шүүлтүүрт — давхардалгүй клиентийн нэрс. */
    clients: client ? [] : await Reel.distinct("client", { published: true, client: { $ne: "" } }),
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });

  await dbConnect();
  const reel = await Reel.findById(id);
  if (!reel) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  const me = await User.findOne({ email: session.user.email }).select("_id").lean();
  const mine = me && String((me as { _id: unknown })._id) === String(reel.uploader);
  if (!mine && !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Эрх байхгүй" }, { status: 403 });
  }

  /* Файлыг ҮЛДЭЭНЭ — өөр reel эсвэл илгээсэн холбоос түүн рүү заасан
     байж болно. Мөрийг л авна. */
  await Reel.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
