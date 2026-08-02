import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import AiCreation from "@/models/AiCreation";
import { refundCredits } from "@/lib/credits";
import { getText2VideoStatus, getImage2VideoStatus } from "@/lib/kling";
import { getPiapiTask, piapiStatus, piapiVideoUrl } from "@/lib/piapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Kling result URLs expire — persist finished videos into /uploads/ai/ so the
// feed owns its assets. Falls back to the remote URL if the download fails.
async function persistVideo(remoteUrl: string, id: string): Promise<string> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return remoteUrl;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 80 * 1024 * 1024) return remoteUrl; // sanity cap
    const dir = path.join(process.cwd(), "public", "uploads", "ai");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `${id}.mp4`), buf);
    return `/uploads/ai/${id}.mp4`;
  } catch {
    return remoteUrl;
  }
}

// GET — fetch one creation; if still processing, poll the engine and update.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const { id } = await params;
    const creation = await AiCreation.findById(id);
    if (!creation) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

    const session = await getServerSession(authOptions);
    let myId = "";
    if (session?.user?.email) {
      const me = await User.findOne({ email: session.user.email.toLowerCase() }).select("_id").lean();
      myId = me ? String(me._id) : "";
    }
    const isOwner = myId && String(creation.user) === myId;
    if (!creation.isPublic && !isOwner) return NextResponse.json({ error: "Хаалттай" }, { status: 403 });

    // Poll the engine only while processing (idempotent: repeat polls are cheap reads).
    if (creation.status === "processing" && creation.taskId) {
      try {
        if (creation.provider === "piapi") {
          const task = await getPiapiTask(creation.taskId);
          const st = piapiStatus(task);
          if (st === "done") {
            const remote = piapiVideoUrl(task);
            if (remote) {
              creation.videoUrl = await persistVideo(remote, String(creation._id));
              creation.status = "done";
              await creation.save();
            }
          } else if (st === "failed") {
            creation.status = "failed";
            creation.error = task.error?.message || task.error?.raw_message || "Engine failed";
            await creation.save();
          }
        } else {
          // legacy: direct Kling tasks
          const result = creation.taskType === "image2video"
            ? await getImage2VideoStatus(creation.taskId)
            : await getText2VideoStatus(creation.taskId);
          const task = result.data;
          if (task?.task_status === "succeed") {
            const remote = task.task_result?.videos?.[0]?.url || "";
            if (remote) {
              creation.videoUrl = await persistVideo(remote, String(creation._id));
              creation.status = "done";
              await creation.save();
            }
          } else if (task?.task_status === "failed") {
            creation.status = "failed";
            creation.error = task.task_status_msg || "Engine failed";
            if (!creation.refunded && creation.cost > 0) {
              await refundCredits({ userId: String(creation.user), amount: creation.cost, reason: "AI_VIDEO_GEN" });
              creation.refunded = true;
            }
            await creation.save();
          }
        }
      } catch { /* poll failure is non-fatal — try again next tick */ }
    }

    const doc = creation.toObject() as unknown as Record<string, unknown>;
    delete doc.fullPrompt; delete doc.taskId;
    return NextResponse.json({
      creation: { ...doc, likes: undefined, liked: myId ? creation.likes.includes(myId) : false, mine: !!isOwner },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — owner removes their creation (file cleanup is best-effort).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    const me = await User.findOne({ email: session.user.email.toLowerCase() }).select("_id role").lean();
    if (!me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

    const { id } = await params;
    const creation = await AiCreation.findById(id);
    if (!creation) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
    if (String(creation.user) !== String(me._id) && me.role !== "admin") {
      return NextResponse.json({ error: "Эрх хүрэхгүй" }, { status: 403 });
    }
    if (creation.videoUrl.startsWith("/uploads/ai/")) {
      await fs.unlink(path.join(process.cwd(), "public", creation.videoUrl)).catch(() => {});
    }
    await creation.deleteOne();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
