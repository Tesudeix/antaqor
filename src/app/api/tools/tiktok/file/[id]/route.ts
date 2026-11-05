import { NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import { Readable } from "stream";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getJob, safeName } from "@/lib/ttgrab";

export const dynamic = "force-dynamic";

/* Бэлэн mp4-ийг ХАВСРАЛТ болгон, зөвхөн ЭЗЭНД гардуулна. Файл public/-д
   биш (.ttfiles/) тул өөр замаар хэн ч хүрэхгүй. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: "id буруу" }, { status: 400 });

  const job = getJob(id, (session.user as { id: string }).id);
  if (!job || job.status !== "done") return NextResponse.json({ error: "Файл олдсонгүй эсвэл хугацаа дууссан" }, { status: 404 });

  let size: number;
  try { size = (await fsp.stat(job.file)).size; }
  catch { return NextResponse.json({ error: "Файл устсан байна" }, { status: 404 }); }

  const name = safeName(job.title);
  return new NextResponse(Readable.toWeb(fs.createReadStream(job.file)) as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="tiktok.mp4"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
