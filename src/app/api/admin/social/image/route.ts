import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// The generic /api/upload writes WebP, which Instagram's container endpoint
// rejects outright (and Threads is picky about too). Social images therefore
// get their own endpoint that always emits a plain, public JPEG.
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1440;

// Meta fetches the image server-side, so the URL must be public — never the
// host the admin happens to be browsing (which may be an internal/alt domain).
function publicOrigin(): string {
  return (process.env.PUBLIC_SITE_URL || "https://antaqor.com").replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Зураг 12MB-аас их байна." }, { status: 413 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const filename = `social-${randomUUID()}.jpg`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    const out = await sharp(buf, { failOn: "error" })
      .rotate()
      .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#0A0A0A" }) // JPEG has no alpha channel
      .jpeg({ quality: 88, progressive: false, chromaSubsampling: "4:2:0" })
      .toBuffer();
    await writeFile(path.join(UPLOAD_DIR, filename), out);

    return NextResponse.json({
      url: `${publicOrigin()}/uploads/${filename}`,
      path: `/uploads/${filename}`,
      size: out.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Зураг боловсруулж чадсангүй" },
      { status: 400 }
    );
  }
}
