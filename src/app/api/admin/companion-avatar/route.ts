import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { writeFile, mkdir, copyFile } from "fs/promises";
import path from "path";
import sharp from "sharp";

// Admin uploads a new Antaqor avatar — overwrites BOTH /public/antaqor.png
// AND /public/antaqorr.png so whichever filename the client requests works.
// Output is normalised to a 256x256 square PNG so it's small and crisp.

const PUB = path.join(process.cwd(), "public");
const TARGET_PRIMARY = path.join(PUB, "antaqorr.png");
const TARGET_SECONDARY = path.join(PUB, "antaqor.png");
const MAX_BYTES = 6 * 1024 * 1024;

async function guard() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email);
}

export async function POST(req: NextRequest) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Файл уншигдсангүй" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Зураг сонгоно уу" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Зөвхөн зургийн файл" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Зураг ${Math.floor(MAX_BYTES / 1024 / 1024)}MB-аас бага байх ёстой` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Square crop 256x256 PNG — small, crisp, identical aspect at all sizes
  let processed: Buffer;
  try {
    processed = await sharp(buffer, { failOn: "error" })
      .resize(512, 512, { fit: "cover", position: "center" })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Зураг боловсруулж чадсангүй" }, { status: 400 });
  }

  await mkdir(PUB, { recursive: true });
  await writeFile(TARGET_PRIMARY, processed);
  // Mirror to the secondary so old caches and either-name lookups both win
  await copyFile(TARGET_PRIMARY, TARGET_SECONDARY).catch(() => {});

  // Return cache-busting URLs so the admin sees the new image immediately
  const v = Date.now();
  return NextResponse.json({
    ok: true,
    primary: `/antaqorr.png?v=${v}`,
    secondary: `/antaqor.png?v=${v}`,
    bytes: processed.length,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
