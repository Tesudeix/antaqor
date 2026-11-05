import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import dbConnect from "@/lib/mongodb";
import Reel from "@/models/Reel";

/* ─── GET /api/reels/[id]/download ─────────────────────────────────────
   Татах тоолуурыг нэмээд файлыг ХАВСРАЛТ болгон буцаана.

   ЯАГААД шууд /uploads/... холбоос өгдөггүй вэ: nginx түүнийг
   `inline` гэж өгдөг тул хөтөч тоглуулаад л орхино — клиент баруун
   товшиж "Save as" хийхээс аргагүй болно. `Content-Disposition:
   attachment` нь дарангуутаа ТАТАГДАХЫГ баталгаажуулна.

   Нэвтрэх шаардлагагүй: тэжээл өөрөө нийтийнх. */

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await dbConnect();
  const reel = await Reel.findById(id).lean().catch(() => null);
  if (!reel || !(reel as { published?: boolean }).published) {
    return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  }

  const r = reel as { videoUrl: string; title?: string; client?: string; mime?: string };

  /* Зам нь бидний өөрсдийн бичсэн утга боловч DB-г хэн нэгэн гараар
     зассан тохиолдолд ч гарч чадахгүй байхаар хатуу шалгав. */
  if (!/^\/uploads\/reels\/[A-Za-z0-9._-]+$/.test(r.videoUrl)) {
    return NextResponse.json({ error: "Файлын зам буруу" }, { status: 400 });
  }
  const abs = path.join(process.cwd(), "public", r.videoUrl);

  let size: number;
  try {
    size = (await stat(abs)).size;
  } catch {
    return NextResponse.json({ error: "Файл олдсонгүй" }, { status: 404 });
  }

  /* Тоолуур нь нэмэлт — бүтэлгүйтвэл татахыг зогсоохгүй. */
  await Reel.updateOne({ _id: id }, { $inc: { downloads: 1 } }).catch(() => {});

  const base = (r.title || r.client || "antaqor-reel")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "antaqor-reel";
  const ext = path.extname(r.videoUrl) || ".mp4";

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
  return new Response(stream, {
    headers: {
      "Content-Type": r.mime || "video/mp4",
      "Content-Length": String(size),
      /* Кирилл нэрийг ASCII хөтөчид ч уншигдахаар filename* хэлбэрээр. */
      "Content-Disposition": `attachment; filename="reel${ext}"; filename*=UTF-8''${encodeURIComponent(base + ext)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
