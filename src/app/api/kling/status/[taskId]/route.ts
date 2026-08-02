import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getImage2VideoStatus } from "@/lib/kling";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

async function persistRemoteVideo(remoteUrl: string): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 100 * 1024 * 1024) return null;
    const ct = res.headers.get("content-type") || "video/mp4";
    const ext = ct.includes("webm") ? "webm" : ct.includes("quicktime") ? "mov" : "mp4";
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `kling-${randomUUID()}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, filename), buf);
    return `/uploads/${filename}`;
  } catch {
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }

    const { taskId } = await params;
    if (!taskId || !/^[A-Za-z0-9_-]{4,128}$/.test(taskId)) {
      return NextResponse.json({ error: "Task ID буруу" }, { status: 400 });
    }

    const result = await getImage2VideoStatus(taskId);
    if (result.code !== 0 || !result.data) {
      return NextResponse.json(
        { error: result.message || "Статус авч чадсангүй" },
        { status: 502 }
      );
    }

    const t = result.data;
    const remoteUrl = t.task_result?.videos?.[0]?.url ?? null;
    const localUrl =
      t.task_status === "succeed" && remoteUrl
        ? await persistRemoteVideo(remoteUrl)
        : null;

    return NextResponse.json({
      taskId: t.task_id,
      status: t.task_status,
      message: t.task_status_msg,
      videoUrl: localUrl || remoteUrl,
      remoteUrl,
      persisted: !!localUrl,
      duration: t.task_result?.videos?.[0]?.duration ?? null,
      createdAt: t.created_at ?? null,
      updatedAt: t.updated_at ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
