import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import YtJob from "@/models/YtJob";
import { storedPath } from "@/lib/ytgrab";

export const dynamic = "force-dynamic";

/* Сервер дээр хуулсан хувилбарыг гардуулна. Файл нийтийн хавтсанд биш
   тул ЗӨВХӨН энэ маршрутаар, зөвхөн ЭЗЭНД гарна. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { id } = await params;
  let p: string;
  try { p = storedPath(id); }
  catch { return NextResponse.json({ error: "id буруу" }, { status: 400 }); }

  await dbConnect();
  const job = await YtJob.findOne({ _id: id, user: userId }).select("fileName stored mode").lean();
  if (!job || !job.stored) return NextResponse.json({ error: "Файл сервер дээр байхгүй" }, { status: 404 });

  let size: number;
  try { size = (await fsp.stat(p)).size; }
  catch { return NextResponse.json({ error: "Файл устсан байна" }, { status: 404 }); }

  const mp3 = job.mode === "mp3";
  const name = (job.fileName || (mp3 ? "audio.mp3" : "video.mp4")).replace(/[\r\n"]/g, "");
  const stream = Readable.toWeb(fs.createReadStream(p)) as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": mp3 ? "audio/mpeg" : "video/mp4",
      "Content-Length": String(size),
      /* Юникод нэрийг filename* -ээр — кирилл гарчиг ASCII талбарт эвдэрдэг. */
      "Content-Disposition": `attachment; filename="${mp3 ? "audio.mp3" : "video.mp4"}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
