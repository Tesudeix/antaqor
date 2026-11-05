import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

/* 2026-10-27: пост дээр PDF хавсаргах. Зураг/видеоны /api/upload-аас тусдаа —
   тэнд sharp/ffmpeg замууд байдаг тул PDF-г энд цэвэр хадгална.
   %PDF магик байт шалгана (нэр өөрчилсөн скриптээс сэргийлнэ). */
export const dynamic = "force-dynamic";
const MAX = 15 * 1024 * 1024;
const DIR = path.join(process.cwd(), "public", "uploads", "docs");

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
  const rl = rateLimit(`upload:pdf:${uid}`, LIMITS.UPLOAD_PER_MINUTE);
  if (!rl.ok) return NextResponse.json({ error: "Хэт олон upload. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });

  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "PDF дээд тал нь 15MB" }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return NextResponse.json({ error: "Зөвхөн PDF файл" }, { status: 400 });
  }
  await mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.pdf`;
  await writeFile(path.join(DIR, name), buf);
  const shown = (file.name || "file.pdf").replace(/[\\/\u0000-\u001f]/g, "").slice(0, 120);
  return NextResponse.json({ url: `/uploads/docs/${name}`, name: shown, size: buf.length });
}
