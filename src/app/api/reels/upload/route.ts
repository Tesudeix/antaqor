import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Reel from "@/models/Reel";
import User from "@/models/User";

/* ─── POST /api/reels/upload ───────────────────────────────────────────
   ОРУУЛАХ нь НЭВТЭРСЭН, ЗӨВШӨӨРӨГДСӨН хүнд л нээлттэй.

   ЯАГААД нэвтрэлтгүй болгоогүй вэ: нэвтрэлтгүй файл хүлээн авах
   эндпойнт нь интернэтийн хэн бүхэнд энэ серверийн дискийг бичих эрх
   өгнө (одоо 1.2GB эзэлсэн). ҮЗЭХ нь нээлттэй — эзний хүссэнээр клиент
   нэвтрэхгүйгээр ороод татна — харин БИЧИХ нь хаалттай.

   Админ байх ШААРДЛАГАГҮЙ: `User.canUploadReels` туг асаалттай энгийн
   гишүүн оруулж чадна. */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "reels");
const MAX_BYTES = 120 * 1024 * 1024; // 120MB — 15 секундын бичлэгт элбэг
const EXT: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  await dbConnect();
  const me = await User.findOne({ email: session.user.email })
    .select("_id name username canUploadReels")
    .lean();
  if (!me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

  const u = me as unknown as { _id: Types.ObjectId; name?: string; username?: string; canUploadReels?: boolean };
  if (!u.canUploadReels && !isAdmin(session.user.email)) {
    return NextResponse.json(
      { error: "Reel оруулах эрх байхгүй. Админаас эрх нээлгэнэ үү.", code: "NO_UPLOAD_RIGHT" },
      { status: 403 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Маягт уншигдсангүй" }, { status: 400 });

  const file = form.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Видео файл алга" }, { status: 400 });
  }
  const ext = EXT[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Зөвхөн MP4, WebM, MOV зөвшөөрнө" },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Файл ${Math.round(MAX_BYTES / 1048576)}MB-аас бага байх ёстой` },
      { status: 413 }
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `reel-${randomUUID()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buf);

  const str = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const reel = await Reel.create({
    title: str("title", 120),
    client: str("client", 80),
    caption: str("caption", 500),
    videoUrl: `/uploads/reels/${filename}`,
    thumbnail: str("thumbnail", 300),
    durationSec: Math.max(0, Number(form.get("durationSec")) || 0),
    mime: file.type,
    bytes: buf.length,
    uploader: u._id,
    uploaderName: u.name || u.username || "",
  });

  console.log(`[reels] upload ${reel._id} · ${filename} · ${Math.round(buf.length / 1024)}KB · by=${session.user.email}`);
  return NextResponse.json({ ok: true, id: String(reel._id), videoUrl: reel.videoUrl });
}

/* Файл их биетэй тул Next-ийн анхдагч задлагчийг тойрч formData() ашиглав. */
export const dynamic = "force-dynamic";
export const maxDuration = 120;
