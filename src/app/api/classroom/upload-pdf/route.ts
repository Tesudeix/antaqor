import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isActiveMember } from "@/lib/membership";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25 MB

// POST — member or admin, PDF only → /uploads/pdf-<uuid>.pdf
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const email = session.user.email || "";
    const admin = isAdmin(email);
    const allowed = admin || (await isActiveMember(userId, email));
    if (!allowed) {
      return NextResponse.json({ error: "Гишүүнчлэлтэй хэрэглэгч л PDF илгээх боломжтой" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const isPdfMime = file.type === "application/pdf";
    const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !isPdfExt) {
      return NextResponse.json({ error: "Зөвхөн PDF файл (.pdf)" }, { status: 400 });
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: `PDF хамгийн ихдээ ${Math.floor(MAX_PDF_SIZE / 1024 / 1024)}MB` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic byte check: PDF files start with "%PDF-"
    if (
      buffer.length < 5 ||
      buffer[0] !== 0x25 || // %
      buffer[1] !== 0x50 || // P
      buffer[2] !== 0x44 || // D
      buffer[3] !== 0x46 || // F
      buffer[4] !== 0x2d    // -
    ) {
      return NextResponse.json({ error: "Файл жинхэнэ PDF биш байна" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `pdf-${randomUUID()}.pdf`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      size: file.size,
      name: file.name,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;
