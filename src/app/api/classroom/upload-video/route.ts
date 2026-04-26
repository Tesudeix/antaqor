import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB cap for course videos

const ALLOWED_EXT = new Set(["mp4", "webm", "mov", "m4v", "ogg"]);

// POST — admin only, video file → /uploads/lesson-<uuid>.<ext> → returns { url }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Зөвхөн видео файл" }, { status: 400 });
    }
    if (file.size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: `Видео хамгийн ихдээ ${Math.floor(MAX_VIDEO_SIZE / 1024 / 1024)}MB` },
        { status: 413 }
      );
    }

    const rawExt = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const ext = ALLOWED_EXT.has(rawExt) ? rawExt : "mp4";

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `lesson-${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
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
export const maxDuration = 300; // 5 min for slow uploads
