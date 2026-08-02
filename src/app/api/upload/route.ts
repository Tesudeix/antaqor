import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mkdir, statfs, stat, writeFile, unlink } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isActiveMember } from "@/lib/membership";
import { isAdmin } from "@/lib/admin";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { sharpSemaphore } from "@/lib/semaphore";
import User from "@/models/User";
import dbConnect from "@/lib/mongodb";

// ─── Video transcode concurrency lock ───
// 1 vCPU droplet — transcoding is CPU-heavy. Allow 1 concurrent ffmpeg job;
// queue waits up to 30s. 20s of 1080p H.264 at preset=fast → 8–15s on this box.
let videoTranscodeRunning = 0;
const MAX_CONCURRENT_TRANSCODE = 1;
const TRANSCODE_QUEUE_TIMEOUT = 30_000;
const TRANSCODE_TIMEOUT = 60_000;

async function acquireTranscode(): Promise<void> {
  const start = Date.now();
  while (videoTranscodeRunning >= MAX_CONCURRENT_TRANSCODE) {
    if (Date.now() - start > TRANSCODE_QUEUE_TIMEOUT) {
      throw new Error("Хэт олон видео хувиргалтанд байна. Дараа дахин.");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  videoTranscodeRunning++;
}
function releaseTranscode() { videoTranscodeRunning = Math.max(0, videoTranscodeRunning - 1); }

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let killed = false;
    const t = setTimeout(() => { killed = true; proc.kill("SIGKILL"); }, TRANSCODE_TIMEOUT);
    let errBuf = "";
    proc.stderr?.on("data", (d) => { errBuf += d.toString().slice(-2000); });
    proc.on("error", (e) => { clearTimeout(t); reject(e); });
    proc.on("close", (code) => {
      clearTimeout(t);
      if (killed) return reject(new Error("ffmpeg timeout"));
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${errBuf.slice(-400)}`));
    });
  });
}

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// ─── Size caps tiered by membership ───
// Bumped from 2MB → 6MB so iPhone photos (typically 4–6MB JPEG) actually
// upload for free-tier users. Multi-image flow on /posts/new was silently
// rejecting first photo and looking broken.
const MAX_FREE_SIZE = 6 * 1024 * 1024;   // 6 MB free
const MAX_PAID_SIZE = 12 * 1024 * 1024;  // 12 MB members

const MAX_OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 1600;
const JPEG_QUALITY = 82;

// ─── Disk-space guard ───
// Minimum free disk space required on the partition (below this, reject uploads)
const MIN_FREE_DISK_BYTES = 500 * 1024 * 1024; // 500 MB

// ─── Magic byte check ───
// Tiny allow-list of real image signatures. Prevents renamed-script uploads.
// HEIC/HEIF added so iPhone photos go through (sharp can decode them).
function detectImageType(buf: Buffer): "jpeg" | "png" | "webp" | "gif" | "heic" | "avif" | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "gif";
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return "webp";
  }
  // HEIC/HEIF (ISOBMFF box): bytes 4..11 are "ftypheic", "ftypheix",
  // "ftyphevc", "ftypmif1", "ftypmsf1". iPhone defaults to HEIC since iOS 11.
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "heic";
    if (["avif", "avis"].includes(brand)) return "avif";
  }
  return null;
}

async function diskAvailable(): Promise<{ free: number; ok: boolean }> {
  try {
    const s = await statfs(UPLOAD_DIR).catch(() => null);
    if (!s) return { free: Number.MAX_SAFE_INTEGER, ok: true };
    const free = s.bavail * s.bsize;
    return { free, ok: free > MIN_FREE_DISK_BYTES };
  } catch {
    return { free: Number.MAX_SAFE_INTEGER, ok: true };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const email = session.user.email || "";
    const admin = isAdmin(email);

    // ─── Check banned status ───
    await dbConnect();
    const userDoc = await User.findById(userId).select("banned uploadBytesMonth uploadMonthResetAt").lean();
    const u = userDoc as unknown as {
      banned?: boolean;
      uploadBytesMonth?: number;
      uploadMonthResetAt?: Date;
    } | null;
    if (u?.banned && !admin) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    const paid = admin || (await isActiveMember(userId, email));

    // ─── Rate limits (tiered) ───
    // Burst cap for everyone (3 uploads / 60s)
    const burst = rateLimit(`upload:burst:${userId}`, LIMITS.UPLOAD_PER_MINUTE);
    if (!burst.ok) {
      return NextResponse.json(
        { error: `Дэндүү олон upload хийлээ. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа дахин оролдоорой.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
      );
    }
    // Daily cap by tier (admins bypass)
    if (!admin) {
      const dayCfg = paid ? LIMITS.UPLOAD_PAID_PER_DAY : LIMITS.UPLOAD_FREE_PER_DAY;
      const day = rateLimit(`upload:day:${userId}`, dayCfg);
      if (!day.ok) {
        const hours = Math.ceil(day.resetInMs / 3600_000);
        return NextResponse.json(
          {
            error: `Өдрийн upload хязгаар хүрлээ (${day.limit}). ~${hours}ц-ийн дараа сэргэнэ.`,
            quotaRemaining: 0,
            paid,
          },
          { status: 429 }
        );
      }
    }

    // ─── Disk guard ───
    const disk = await diskAvailable();
    if (!disk.ok && !admin) {
      console.error("Upload rejected: disk pressure", disk);
      return NextResponse.json({ error: "Серверийн сангийн зай дутуу байна." }, { status: 507 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    // Branch upfront: image vs video paths have different size caps + processing.
    const isVideo = file.type.startsWith("video/");
    // HEIC/HEIF added for iPhone-default photos. Some iOS browsers send the
    // mime as application/octet-stream when sharing — magic-byte check below
    // is the real gate, so we accept "" / "application/octet-stream" too.
    const allowedImageMime = [
      "image/jpeg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif", "image/avif",
      "", "application/octet-stream",
    ];
    const allowedVideoMime = ["video/mp4", "video/webm", "video/quicktime"];

    if (!isVideo && !allowedImageMime.includes(file.type)) {
      return NextResponse.json(
        { error: "Зөвхөн JPEG, PNG, WebP, GIF, HEIC, AVIF, MP4, WebM, MOV." },
        { status: 400 }
      );
    }
    if (isVideo && !allowedVideoMime.includes(file.type)) {
      return NextResponse.json({ error: "Дэмждэг видео: MP4, WebM, MOV." }, { status: 400 });
    }

    // Size cap — videos get a higher ceiling (25MB) since 20s of HD is usually
    // 8–15MB; admin/paid keep their default but apply the larger of the two caps.
    const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
    const baseSize = admin || paid ? MAX_PAID_SIZE : MAX_FREE_SIZE;
    const MAX_SIZE = isVideo ? Math.max(MAX_VIDEO_SIZE, baseSize) : baseSize;

    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл дэндүү том. Max ${Math.floor(MAX_SIZE / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл дэндүү том. Max ${Math.floor(MAX_SIZE / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ─── Image-only: magic-byte verification ───
    if (!isVideo) {
      const real = detectImageType(buffer);
      if (!real) {
        return NextResponse.json(
          { error: "Файл жинхэнэ зураг биш байна." },
          { status: 400 }
        );
      }
    }

    // ─── Monthly byte cap ───
    if (!admin) {
      const monthReset = u?.uploadMonthResetAt ? new Date(u.uploadMonthResetAt) : new Date(0);
      const now = new Date();
      const monthPassed = (now.getTime() - monthReset.getTime()) > 30 * 24 * 60 * 60_000;
      const currentBytes = monthPassed ? 0 : (u?.uploadBytesMonth || 0);
      const monthCap = paid ? 500 * 1024 * 1024 : 50 * 1024 * 1024; // 500MB paid, 50MB free
      if (currentBytes + buffer.length > monthCap) {
        const mb = Math.floor(monthCap / 1024 / 1024);
        return NextResponse.json(
          { error: `Сарын upload хязгаар ${mb}MB хүрлээ. ${paid ? "" : "Дээшлүүлэх боломжтой."}` },
          { status: 429 }
        );
      }
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    let processedSize = 0;
    let filename = "";

    if (isVideo) {
      // ─── Video: transcode via ffmpeg under a 1-concurrency lock.
      //   • H.264 baseline (max compat, including iOS Safari)
      //   • Scale to ≤1280×720 — tablet/phone-friendly, plenty for short clips
      //   • CRF 26 + preset fast — strong quality/size ratio in <15s for 20s clips
      //   • +faststart so the browser can start playing while still downloading
      //   • Poster JPG generated at 0.5s for a good first frame
      const id = randomUUID();
      const tempIn = path.join(tmpdir(), `up-${id}.in`);
      filename = `vid-${id}.mp4`;
      const filepath = path.join(UPLOAD_DIR, filename);
      const posterPath = path.join(UPLOAD_DIR, `vid-${id}-poster.jpg`);

      await writeFile(tempIn, buffer);
      try {
        await acquireTranscode();
      } catch (e: unknown) {
        await unlink(tempIn).catch(() => {});
        const msg = e instanceof Error ? e.message : "Transcode queue full";
        return NextResponse.json({ error: msg }, { status: 503 });
      }
      try {
        await runFfmpeg([
          "-y",
          "-i", tempIn,
          "-vf", "scale='min(1280,iw)':-2,format=yuv420p",
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "26",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          "-max_muxing_queue_size", "1024",
          filepath,
        ]);
        // Poster — best-effort, doesn't fail the upload if it errors.
        await runFfmpeg([
          "-y",
          "-ss", "00:00:00.5",
          "-i", filepath,
          "-frames:v", "1",
          "-q:v", "3",
          "-vf", "scale='min(1280,iw)':-2",
          posterPath,
        ]).catch(() => { /* poster optional */ });
      } catch (err: unknown) {
        // Transcode failed — fall back to the raw file so the user still gets
        // a working video, just bigger.
        const msg = err instanceof Error ? err.message : "transcode failed";
        console.warn("[upload] ffmpeg failed, persisting raw:", msg);
        await writeFile(filepath, buffer);
      } finally {
        releaseTranscode();
        await unlink(tempIn).catch(() => {});
      }
      const s = await stat(filepath);
      processedSize = s.size;
    } else {
      // ─── Image: run through sharp under a semaphore (OOM guard) ───
      let release: (() => void) | null = null;
      try {
        release = await sharpSemaphore.acquire(15_000); // 15s queue timeout
      } catch {
        return NextResponse.json(
          { error: "Сервер завгүй байна. Хэдэн секундийн дараа оролдоорой." },
          { status: 503 }
        );
      }
      try {
        filename = `${randomUUID()}.webp`;
        const filepath = path.join(UPLOAD_DIR, filename);

        await sharp(buffer, { failOn: "error" })
          .resize(MAX_OUTPUT_WIDTH, MAX_OUTPUT_HEIGHT, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: JPEG_QUALITY, effort: 4 })
          .toFile(filepath);

        const s = await stat(filepath);
        processedSize = s.size;
      } finally {
        if (release) release();
      }
    }

    // ─── Persist monthly quota usage ───
    if (!admin) {
      const now = new Date();
      const monthReset = u?.uploadMonthResetAt ? new Date(u.uploadMonthResetAt) : new Date(0);
      const shouldReset = (now.getTime() - monthReset.getTime()) > 30 * 24 * 60 * 60_000;
      if (shouldReset) {
        await User.findByIdAndUpdate(userId, {
          uploadBytesMonth: processedSize,
          uploadMonthResetAt: now,
        });
      } else {
        await User.findByIdAndUpdate(userId, {
          $inc: { uploadBytesMonth: processedSize },
        });
      }
    }

    return NextResponse.json({
      url: `/uploads/${filename}`,
      // Naming convention: video filename is `vid-{uuid}.mp4` and the poster
      // sits next to it as `vid-{uuid}-poster.jpg`. Clients that don't read
      // this field can derive it from the video URL.
      poster: isVideo ? `/uploads/${filename.replace(/\.mp4$/, "-poster.jpg")}` : undefined,
      kind: isVideo ? "video" : "image",
      size: processedSize,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
