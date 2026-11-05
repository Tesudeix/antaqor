import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
// Зөвхөн баримт/архив/зураг. HTML, SVG, JS зэрэг ажиллах боломжтой төрлийг
// оруулахгүй — /uploads нь сайттай ижил origin тул XSS болно.
const ALLOWED = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md",
  "zip", "png", "jpg", "jpeg", "webp",
]);

// POST — ЗӨВХӨН админ → /uploads/mat-<uuid>.<ext>
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const file = (await req.formData()).get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Файл олдсонгүй" }, { status: 400 });
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED.has(ext)) {
      return NextResponse.json({ error: "Энэ төрлийн файл зөвшөөрөгдөөгүй (pdf, docx, xlsx, pptx, zip, зураг…)" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `Файл хамгийн ихдээ ${MAX_SIZE / 1024 / 1024}MB` }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (ext === "pdf" && buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return NextResponse.json({ error: "Файл жинхэнэ PDF биш байна" }, { status: 400 });
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `mat-${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}`, size: file.size, name: file.name, kind: "file" });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
