import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import dbConnect from "@/lib/mongodb";
import YtJob from "@/models/YtJob";
import { resolveAgent, storedPath, YT_DIR } from "@/lib/ytgrab";

export const dynamic = "force-dynamic";
/* Урт хуулалт. nginx тал дээр /api/agent/ytgrab/upload-д тусдаа
   location + proxy_request_buffering off + 2400s байхыг шаардана. */
export const maxDuration = 1800;

/* Нэг файлын дээд хэмжээ — 4K 10 минут нь ~1.3 GB. */
const MAX_BYTES = 1_600_000_000;

/* Бүх хэрэглэгчийн нийт байршуулалтын төсөв. Droplet дээр ~20 GB л
   чөлөөтэй бөгөөд тэнд бусад 9 апп ажиллаж байгаа — хэрэглэгчийн
   видеонууд дискийг дүүргэвэл САЙТ БҮХЭЛДЭЭ унана. Тиймээс хаалт нь
   хэрэглэгч тус бүрийн биш, НИЙТИЙН төсөв байх ёстой. */
const TOTAL_BUDGET = 8_000_000_000;

async function usedBytes(): Promise<number> {
  let names: string[];
  try { names = await fsp.readdir(YT_DIR); } catch { return 0; }
  let sum = 0;
  for (const n of names) {
    try { sum += (await fsp.stat(path.join(YT_DIR, n))).size; } catch { /* дараагийнх */ }
  }
  return sum;
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const agent = await resolveAgent(req.headers.get("x-ytgrab-token"));
  if (!agent) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id") || "";
  let dest: string;
  try { dest = storedPath(id); }
  catch { return NextResponse.json({ error: "id буруу" }, { status: 400 }); }

  /* Ажил нь ЭНЭ agent-ийн эзний байх ёстой. */
  const job = await YtJob.findOne({ _id: id, user: agent.user });
  if (!job) return NextResponse.json({ error: "Ажил олдсонгүй" }, { status: 404 });
  if (!job.wantUpload) return NextResponse.json({ error: "Хуулах хүсэлт байхгүй" }, { status: 400 });

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "Файл хэт том (1.6 GB-аас дээш)" }, { status: 413 });
  }

  const used = await usedBytes();
  if (used + Math.max(declared, 0) > TOTAL_BUDGET) {
    return NextResponse.json(
      { error: "Серверийн хадгалах зай дүүрсэн. Файл чиний машин дээр хэвээр байгаа." },
      { status: 507 },
    );
  }
  if (!req.body) return NextResponse.json({ error: "Бие хоосон" }, { status: 400 });

  await fsp.mkdir(YT_DIR, { recursive: true });
  const tmp = dest + ".part";

  /* Урсгалаар бичнэ — 1 GB-ийг санд бариад серверийг унагахгүй.
     Хэмжээг урсгал дээр нь ч хянана: content-length хуурамч байж
     болно. */
  let written = 0;
  const src = Readable.fromWeb(req.body as never);
  src.on("data", (c: Buffer) => {
    written += c.length;
    if (written > MAX_BYTES) src.destroy(new Error("Хэмжээ хэтэрлээ"));
  });

  try {
    await pipeline(src, fs.createWriteStream(tmp));
    await fsp.rename(tmp, dest);
  } catch (e) {
    await fsp.unlink(tmp).catch(() => {});
    return NextResponse.json({ error: (e as Error).message || "Хуулж чадсангүй" }, { status: 500 });
  }

  job.stored = true;
  job.fileSize = written;
  await job.save();
  return NextResponse.json({ ok: true, bytes: written });
}
