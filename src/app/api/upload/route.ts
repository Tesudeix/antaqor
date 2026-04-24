import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mkdir, statfs, stat } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { isActiveMember } from "@/lib/membership";
import { isAdmin } from "@/lib/admin";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { sharpSemaphore } from "@/lib/semaphore";
import User from "@/models/User";
import dbConnect from "@/lib/mongodb";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// ─── Size caps tiered by membership ───
const MAX_FREE_SIZE = 2 * 1024 * 1024;   // 2 MB — prevents disk bomb from fresh accounts
const MAX_PAID_SIZE = 10 * 1024 * 1024;  // 10 MB for members

const MAX_OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 1600;
const JPEG_QUALITY = 82;

// ─── Disk-space guard ───
// Minimum free disk space required on the partition (below this, reject uploads)
const MIN_FREE_DISK_BYTES = 500 * 1024 * 1024; // 500 MB

// ─── Magic byte check ───
// Tiny allow-list of real image signatures. Prevents renamed-script uploads.
function detectImageType(buf: Buffer): "jpeg" | "png" | "webp" | "gif" | null {
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

    // ─── Size constraints ───
    const MAX_SIZE = admin || paid ? MAX_PAID_SIZE : MAX_FREE_SIZE;

    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл дэндүү том. Таны түвшинд max ${Math.floor(MAX_SIZE / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `Файл дэндүү том. Max ${Math.floor(MAX_SIZE / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }

    // Header MIME hint (cheap pre-filter)
    const allowedMime = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedMime.includes(file.type)) {
      return NextResponse.json({ error: "Зөвхөн JPEG, PNG, WebP, GIF." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ─── Magic byte verification (don't trust the Content-Type header) ───
    const real = detectImageType(buffer);
    if (!real) {
      return NextResponse.json(
        { error: "Файл жинхэнэ зураг биш байна." },
        { status: 400 }
      );
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

    // ─── Sharp processing under semaphore (prevent OOM) ───
    let release: (() => void) | null = null;
    try {
      release = await sharpSemaphore.acquire(15_000); // 15s queue timeout
    } catch {
      return NextResponse.json(
        { error: "Сервер завгүй байна. Хэдэн секундийн дараа оролдоорой." },
        { status: 503 }
      );
    }

    let processedSize = 0;
    let filename = "";
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

    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
