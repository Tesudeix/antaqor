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

// GET - fetch hero slides
export async function GET() {
  try {
    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "heroSlides" }).lean();
    const slides = setting?.value ? JSON.parse(setting.value as string) : [];
    return NextResponse.json({ slides });
  } catch {
    return NextResponse.json({ slides: [] });
  }
}

// POST - add a hero slide (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const videoUrl = formData.get("videoUrl") as string | null;

    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "heroSlides" });
    const slides: { url: string; type: string }[] = setting?.value
      ? JSON.parse(setting.value as string)
      : [];

    if (videoUrl) {
      slides.push({ url: videoUrl, type: "video" });
    } else if (file) {
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ error: "Max 15MB" }, { status: 413 });
      }

      await mkdir(UPLOAD_DIR, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `hero-${randomUUID()}.webp`;
      const filepath = path.join(UPLOAD_DIR, filename);

      await sharp(buffer)
        .resize(1200, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 88 })
        .toFile(filepath);

      slides.push({ url: `/uploads/${filename}`, type: "image" });
    } else {
      return NextResponse.json({ error: "No file or videoUrl" }, { status: 400 });
    }

    await SiteSettings.findOneAndUpdate(
      { key: "heroSlides" },
      { value: JSON.stringify(slides) },
      { upsert: true }
    );

    return NextResponse.json({ slides });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - remove a slide by index (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { index } = await req.json();
    await dbConnect();

    const setting = await SiteSettings.findOne({ key: "heroSlides" });
    const slides: { url: string; type: string }[] = setting?.value
      ? JSON.parse(setting.value as string)
      : [];

    if (index < 0 || index >= slides.length) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    const removed = slides.splice(index, 1)[0];

    // Delete file if it's a local upload
    if (removed.url.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", removed.url);
      try {
        await unlink(filePath);
      } catch {
        /* ignore */
      }
    }

    await SiteSettings.findOneAndUpdate(
      { key: "heroSlides" },
      { value: JSON.stringify(slides) },
      { upsert: true }
    );

    return NextResponse.json({ slides });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
