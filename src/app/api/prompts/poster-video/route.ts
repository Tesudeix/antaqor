import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/* ─── POST /api/prompts/poster-video — постер зураг → 6с MP4 (2026-10-06) ──
   /prompts/new дээрх "Видео татах": постерын PNG аль хэдийн /api/upload-оор
   /uploads/<uuid>.webp болсон байна. Энд ffmpeg түүнийг зөөлөн zoom-in +
   fade-in бүхий 1080×1350, 6 секундийн MP4 болгоно (Reels/TikTok-д шууд).

   Хэмжсэн: дроплет дээр ~5с CPU, ~600KB файл. Нэг зэрэг НЭГ л ажил
   (2 vCPU — upload-ийн видео хувиргалттай өрсөлдөхгүйн тулд).

   АЮУЛГҮЙ БАЙДАЛ: оролт нь зөвхөн манай /uploads доторх нэр — гадны URL,
   "../" зам хүлээж авахгүй. ffmpeg-д аргумент массивээр (shell-гүй). */

const UPLOADS = path.join(process.cwd(), "public", "uploads");
const OUT_DIR = path.join(UPLOADS, "videos");
const SAFE = /^\/uploads\/([A-Za-z0-9-]{8,64}\.(?:webp|png|jpe?g))$/;

let running = false;

function ffmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stderr?.on("data", (d) => { err = (err + d.toString()).slice(-1500); });
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg ${code}: ${err.slice(-300)}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const rl = rateLimit(`poster-video:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!rl.ok) return NextResponse.json({ error: "Дэндүү олон. Түр хүлээгээд дахин." }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { image?: string };
  const m = String(body.image || "").match(SAFE);
  if (!m) return NextResponse.json({ error: "Зургийн хаяг буруу" }, { status: 400 });
  const input = path.join(UPLOADS, m[1]);
  if (!existsSync(input)) return NextResponse.json({ error: "Зураг олдсонгүй" }, { status: 404 });

  if (running) {
    return NextResponse.json({ error: "Өөр видео үүсгэж байна. Хэдэн секундын дараа дахин." }, { status: 503 });
  }
  running = true;
  try {
    await mkdir(OUT_DIR, { recursive: true });
    const name = `poster-${randomUUID()}.mp4`;
    await ffmpeg(
      [
        "-y", "-loglevel", "error",
        "-loop", "1", "-i", input,
        "-vf",
        "scale=1620:-2,zoompan=z='min(zoom+0.0006,1.10)':d=180:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=30,fade=t=in:st=0:d=0.5,format=yuv420p",
        "-t", "6",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-movflags", "+faststart",
        path.join(OUT_DIR, name),
      ],
      60_000
    );
    return NextResponse.json({ url: `/uploads/videos/${name}` });
  } catch (e) {
    console.error("[poster-video]", e);
    return NextResponse.json({ error: "Видео үүсгэж чадсангүй" }, { status: 500 });
  } finally {
    running = false;
  }
}
