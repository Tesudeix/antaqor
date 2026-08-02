import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

// Single admin-managed image for the landing "Нэгдэх" join card.
// Same SiteSettings key/value + sharp→webp pattern as api/hero/route.ts.
const KEY = "joinCardImage";
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function removeIfLocal(url: string | null | undefined) {
  if (url && url.startsWith("/uploads/")) {
    try {
      await unlink(path.join(process.cwd(), "public", url));
    } catch {
      /* already gone — ignore */
    }
  }
}

// GET — public: current join-card image (or null → frontend uses a fallback).
export async function GET() {
  try {
    await dbConnect();
    const setting = await SiteSettings.findOne({ key: KEY }).lean();
    return NextResponse.json({ url: setting?.value || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}

// POST — admin only: upload/replace the join-card image.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Зөвхөн зураг" }, { status: 400 });
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "Зураг хамгийн ихдээ 15MB" }, { status: 413 });
    }

    await dbConnect();
    await mkdir(UPLOAD_DIR, { recursive: true });

    const prev = await SiteSettings.findOne({ key: KEY });
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `joincard-${randomUUID()}.webp`;
    // Landscape banner — fits the card's 16:9 frame without upscaling.
    await sharp(buffer)
      .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(path.join(UPLOAD_DIR, filename));

    const url = `/uploads/${filename}`;
    await SiteSettings.findOneAndUpdate(
      { key: KEY },
      { value: url },
      { upsert: true }
    );
    await removeIfLocal(prev?.value as string | undefined);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — admin only: clear the join-card image (frontend falls back).
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await dbConnect();
    const prev = await SiteSettings.findOne({ key: KEY });
    await removeIfLocal(prev?.value as string | undefined);
    await SiteSettings.findOneAndUpdate({ key: KEY }, { value: "" }, { upsert: true });
    return NextResponse.json({ url: null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
