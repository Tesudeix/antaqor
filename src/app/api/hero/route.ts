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

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// GET - fetch current hero image
export async function GET() {
  try {
    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "heroImage" }).lean();
    return NextResponse.json({ url: setting?.value || null });
  } catch {
    return NextResponse.json({ url: null });
  }
}

// POST - upload new hero image (admin only)
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

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 15MB." }, { status: 413 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP allowed" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    await dbConnect();

    // Delete old hero image file
    const oldSetting = await SiteSettings.findOne({ key: "heroImage" });
    if (oldSetting?.value) {
      const oldFile = path.join(process.cwd(), "public", oldSetting.value);
      try { await unlink(oldFile); } catch { /* ignore */ }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `hero-${randomUUID()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await sharp(buffer)
      .resize(1200, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(filepath);

    const url = `/uploads/${filename}`;

    await SiteSettings.findOneAndUpdate(
      { key: "heroImage" },
      { value: url },
      { upsert: true }
    );

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - remove hero image (admin only)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const setting = await SiteSettings.findOne({ key: "heroImage" });
    if (setting?.value) {
      const filePath = path.join(process.cwd(), "public", setting.value);
      try { await unlink(filePath); } catch { /* ignore */ }
      await SiteSettings.deleteOne({ key: "heroImage" });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
