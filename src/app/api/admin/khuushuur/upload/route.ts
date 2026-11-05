import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";

/* POST /api/admin/khuushuur/upload — зөвхөн админ. multipart `file`.
   Зураг → 1200px webp, public/uploads/khuushuur/ дотор. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "public", "uploads", "khuushuur");

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!f || typeof f === "string") return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) return NextResponse.json({ error: "15MB-аас их" }, { status: 413 });
  await mkdir(DIR, { recursive: true });
  try {
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const name = `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.webp`;
    await writeFile(path.join(DIR, name), out);
    return NextResponse.json({ url: `/uploads/khuushuur/${name}` });
  } catch {
    return NextResponse.json({ error: "Зураг биш байна" }, { status: 415 });
  }
}
