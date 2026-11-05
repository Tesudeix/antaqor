import { NextRequest, NextResponse } from "next/server";
import { mkdir, mkdtemp, realpath, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
const exec = promisify(execFile);
let rendering = false;
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return unauthorized();
  if (rendering) return NextResponse.json({ error: "Өөр Reel бэлтгэж байна. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  let url: URL;
  try { url = new URL(String(body.imageUrl), "https://antaqor.com"); } catch { return NextResponse.json({ error: "Зураг сонгоно уу" }, { status: 400 }); }
  if (url.origin !== "https://antaqor.com" || !/^\/uploads\/[^/]+\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) return NextResponse.json({ error: "Эхлээд зургаа студид оруулна уу. Дараа нь Reel болгоно." }, { status: 400 });
  rendering = true;
  let temp = "";
  try {
    const folder = await realpath(path.join(process.cwd(), "public", "uploads"));
    const source = await realpath(path.join(folder, path.basename(url.pathname)));
    if (!source.startsWith(folder + path.sep)) throw new Error("Зургийн зам буруу");
    temp = await mkdtemp(path.join(tmpdir(), "antaqor-reel-"));
    const image = path.join(temp, "frame.jpg");
    await sharp(source).rotate().resize(720, 1280, { fit: "contain", background: "#202126" }).flatten({ background: "#202126" }).jpeg().toFile(image);
    const name = `social-reel-${randomUUID()}.mp4`;
    await mkdir(folder, { recursive: true });
    const output = path.join(folder, name);
    try {
      await exec("ffmpeg", ["-hide_banner", "-loglevel", "error", "-loop", "1", "-i", image, "-t", "10", "-vf", "scale=720:1280,setsar=1", "-r", "25", "-c:v", "libx264", "-threads", "1", "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", output], { timeout: 120000, maxBuffer: 1024 * 1024 });
    } catch { await rm(output, { force: true }); throw new Error("Reel боловсруулахад алдаа гарлаа. Дахин оролдоно уу."); }
    return NextResponse.json({ url: `https://antaqor.com/uploads/${name}`, duration: 10, width: 720, height: 1280 });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Reel үүсгэж чадсангүй" }, { status: 400 }); }
  finally { rendering = false; if (temp) await rm(temp, { recursive: true, force: true }); }
}
