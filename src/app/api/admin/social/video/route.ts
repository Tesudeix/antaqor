import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, mkdtemp, rename, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
const exec = promisify(execFile);
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  if (!await getAdminSession()) return unauthorized();
  const data = await req.formData().catch(() => null);
  const file = data?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "MP4 видео сонгоно уу" }, { status: 400 });
  if (file.size > 150 * 1024 * 1024) return NextResponse.json({ error: "Видео 150 MB-аас бага байх ёстой" }, { status: 413 });
  const temp = await mkdtemp(path.join(tmpdir(), "antaqor-video-"));
  try {
    const input = path.join(temp, "input.mp4");
    await writeFile(input, Buffer.from(await file.arrayBuffer()));
    const probe = await exec("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", input], { timeout: 20000, maxBuffer: 1024 * 1024 });
    const info = JSON.parse(probe.stdout);
    const video = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    const duration = Number(info.format?.duration);
    if (!video || !Number.isFinite(duration) || duration < 4 || duration > 60) throw new Error("Reel нь 4–60 секундийн видео байх ёстой.");
    if (!String(info.format?.format_name).includes("mp4") || !["h264", "hevc"].includes(video.codec_name)) throw new Error("MP4, H.264 эсвэл H.265 видео оруулна уу.");
    if (Math.abs(Number(video.width) / Number(video.height) - 9 / 16) > 0.02 || video.width < 540 || video.height < 960) throw new Error("Reel нь босоо 9:16, хамгийн багадаа 540 × 960 хэмжээтэй байх ёстой.");
    const [num, den] = String(video.avg_frame_rate || "0/1").split("/").map(Number);
    if (num / den < 23 || num / den > 60) throw new Error("Видео 23–60 FPS байх ёстой.");
    if (info.streams.some((s: { codec_type: string; codec_name: string }) => s.codec_type === "audio" && s.codec_name !== "aac")) throw new Error("Видеоны дуу AAC форматтай байх ёстой.");
    const name = `social-video-${randomUUID()}.mp4`;
    const folder = path.join(process.cwd(), "public", "uploads");
    await mkdir(folder, { recursive: true });
    await rename(input, path.join(folder, name));
    return NextResponse.json({ url: `https://antaqor.com/uploads/${name}`, duration, width: video.width, height: video.height });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error && !e.message.includes("Command failed") ? e.message : "Видео файлыг уншиж чадсангүй. MP4 файл шалгана уу." }, { status: 400 });
  } finally { await rm(temp, { recursive: true, force: true }); }
}
