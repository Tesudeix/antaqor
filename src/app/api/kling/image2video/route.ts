import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startImage2Video } from "@/lib/kling";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    const body = await req.json();
    const { imageUrl, prompt, negativePrompt, duration, mode, aspectRatio } = body || {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json({ error: "Зураг сонгоно уу" }, { status: 400 });
    }
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json({ error: "Тайлбар хэт богино байна" }, { status: 400 });
    }
    if (prompt.length > 2500) {
      return NextResponse.json({ error: "Тайлбар хэт урт байна" }, { status: 400 });
    }
    if (duration !== "5" && duration !== "10") {
      return NextResponse.json({ error: "Үргэлжлэх хугацаа буруу" }, { status: 400 });
    }
    if (mode !== "std" && mode !== "pro") {
      return NextResponse.json({ error: "Горим буруу" }, { status: 400 });
    }
    if (!["16:9", "9:16", "1:1"].includes(aspectRatio)) {
      return NextResponse.json({ error: "Хэлбэр буруу" }, { status: 400 });
    }

    const absoluteUrl = imageUrl.startsWith("http")
      ? imageUrl
      : `${process.env.NEXTAUTH_URL || "https://antaqor.com"}${imageUrl}`;

    const result = await startImage2Video({
      imageUrl: absoluteUrl,
      prompt: prompt.trim(),
      negativePrompt: negativePrompt?.trim() || "",
      duration,
      mode,
      aspectRatio,
    });

    if (result.code !== 0 || !result.data) {
      return NextResponse.json(
        { error: result.message || "Видео үүсгэх API алдаа", code: result.code },
        { status: 502 }
      );
    }

    return NextResponse.json({
      taskId: result.data.task_id,
      status: result.data.task_status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
