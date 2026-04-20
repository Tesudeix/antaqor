import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// GET - fetch current hero music URL
export async function GET() {
  try {
    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "heroMusic" }).lean();
    const url = setting?.value || "/fire-again.mp3";
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: "/fire-again.mp3" });
  }
}

// POST - upload new hero music (admin only)
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

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Max 20MB" }, { status: 413 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    if (!["mp3", "m4a", "ogg", "wav", "webm", "aac"].includes(ext)) {
      return NextResponse.json({ error: "Зөвхөн mp3, m4a, ogg, wav, aac файл" }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Delete old uploaded music if exists
    await dbConnect();
    const oldSetting = await SiteSettings.findOne({ key: "heroMusic" }).lean();
    if (oldSetting?.value && (oldSetting.value as string).startsWith("/uploads/")) {
      try {
        await unlink(path.join(process.cwd(), "public", oldSetting.value as string));
      } catch { /* ignore */ }
    }

    const filename = `hero-music-${randomUUID()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;

    await SiteSettings.findOneAndUpdate(
      { key: "heroMusic" },
      { value: url },
      { upsert: true }
    );

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - reset to default music (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "heroMusic" }).lean();
    if (setting?.value && (setting.value as string).startsWith("/uploads/")) {
      try {
        await unlink(path.join(process.cwd(), "public", setting.value as string));
      } catch { /* ignore */ }
    }

    await SiteSettings.findOneAndUpdate(
      { key: "heroMusic" },
      { value: "/fire-again.mp3" },
      { upsert: true }
    );

    return NextResponse.json({ url: "/fire-again.mp3" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
