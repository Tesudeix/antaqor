import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";

/* POST /api/admin/shop/upload — зөвхөн админ. multipart `file`.
   • Зураг (jpeg/png/webp/heic/avif) → 1600px webp
   • 3D загвар .glb (магик "glTF") → шууд хадгална, ≤ 30MB
   public/uploads/shop/ дотор. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DIR = path.join(process.cwd(), "public", "uploads", "shop");

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const fd = await req.formData().catch(() => null);
  const f = fd?.get("file");
  if (!f || typeof f === "string") return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  const buf = Buffer.from(await f.arrayBuffer());
  if (buf.length > 30 * 1024 * 1024) return NextResponse.json({ error: "30MB-аас их" }, { status: 413 });
  await mkdir(DIR, { recursive: true });
  const id = Date.now().toString(36) + "-" + randomBytes(4).toString("hex");

  if (buf.slice(0, 4).toString("ascii") === "glTF") {
    const name = `${id}.glb`;
    await writeFile(path.join(DIR, name), buf);
    return NextResponse.json({ url: `/uploads/shop/${name}`, kind: "model" });
  }
  try {
    const out = await sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const name = `${id}.webp`;
    await writeFile(path.join(DIR, name), out);
    return NextResponse.json({ url: `/uploads/shop/${name}`, kind: "image" });
  } catch {
    return NextResponse.json({ error: "Зураг эсвэл .glb файл биш байна" }, { status: 415 });
  }
}
