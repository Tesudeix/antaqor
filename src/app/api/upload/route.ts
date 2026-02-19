import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB raw input
const MAX_OUTPUT_WIDTH = 1200;
const MAX_OUTPUT_HEIGHT = 1600;
const JPEG_QUALITY = 82;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB." },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 10MB." },
        { status: 413 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, and GIF allowed" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());

    const filename = `${randomUUID()}.webp`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await sharp(buffer)
      .resize(MAX_OUTPUT_WIDTH, MAX_OUTPUT_HEIGHT, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: JPEG_QUALITY })
      .toFile(filepath);

    const url = `/uploads/${filename}`;

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
