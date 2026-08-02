import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import AiCreation from "@/models/AiCreation";
import { createSeedanceTask, type SeedanceTier } from "@/lib/piapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// FREE BETA — generations are not charged in ₵ for now. The PiAPI wallet pays
// real money per second of video, so we cap per-user usage instead.
const MAX_CONCURRENT = 3;
const MAX_PER_DAY = 8;

// Camera-motion presets (Higgsfield-style). Server is the source of truth —
// the client sends only the id. (Module-local: route files export handlers only.)
const MOTION_PRESETS: Record<string, { label: string; frag: string }> = {
  crash_zoom: { label: "Crash Zoom", frag: "rapid crash zoom in toward the subject, high energy, slight motion blur" },
  dolly_in: { label: "Dolly In", frag: "slow cinematic dolly in toward the subject, shallow depth of field" },
  dolly_out: { label: "Dolly Out Reveal", frag: "smooth dolly out revealing the full scene around the subject" },
  orbit_360: { label: "360 Orbit", frag: "camera orbits 360 degrees around the subject, consistent framing" },
  fpv_drone: { label: "FPV Drone", frag: "fast FPV drone shot flying through the scene, dynamic banking turns" },
  bullet_time: { label: "Bullet Time", frag: "bullet time effect, frozen moment while the camera sweeps around" },
  slow_mo: { label: "Slow Motion", frag: "ultra slow motion, 120fps feel, fine detail and floating particles" },
  handheld: { label: "Handheld", frag: "handheld documentary style camera, subtle shake, raw energy" },
  crane_up: { label: "Crane Up", frag: "crane shot rising upward, revealing the scene from above" },
  close_up: { label: "Face Close-up", frag: "extreme close-up on the face, shallow depth of field, cinematic lighting" },
  zoom_earth: { label: "Earth Zoom Out", frag: "dramatic zoom out from the subject up through the clouds to a view of Earth" },
  static_cine: { label: "Static Cinematic", frag: "static tripod shot, subtle ambient motion, film grain, cinematic color grade" },
};

const TIERS: SeedanceTier[] = ["mini", "fast", "pro"];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }
    await dbConnect();
    const user = await User.findOne({ email: session.user.email.toLowerCase() }).select("name avatar credits banned");
    if (!user) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    if (user.banned) return NextResponse.json({ error: "Хандалт хаагдсан" }, { status: 403 });

    const body = await req.json();
    const prompt = String(body.prompt || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const presetId = String(body.presetId || "");
    const engine: SeedanceTier = TIERS.includes(body.engine) ? body.engine : "mini";
    const duration = body.duration === "10" ? "10" : "5";
    const aspectRatio = ["16:9", "9:16", "1:1"].includes(body.aspectRatio) ? body.aspectRatio : "9:16";
    const resolution = ["480p", "720p", "1080p"].includes(body.resolution) ? body.resolution : "720p";
    const isPublic = body.isPublic !== false;

    if (!prompt && !imageUrl) return NextResponse.json({ error: "Тайлбар бичих эсвэл зураг оруулна уу" }, { status: 400 });
    if (prompt.length > 2000) return NextResponse.json({ error: "Тайлбар хэт урт" }, { status: 400 });

    // ── Free-beta guardrails ──
    const processing = await AiCreation.countDocuments({ user: user._id, status: "processing" });
    if (processing >= MAX_CONCURRENT) {
      return NextResponse.json({ error: `Зэрэг ${MAX_CONCURRENT} видео боловсруулах хязгаартай — түр хүлээнэ үү` }, { status: 429 });
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = await AiCreation.countDocuments({ user: user._id, createdAt: { $gt: dayAgo }, status: { $ne: "failed" } });
    if (today >= MAX_PER_DAY) {
      return NextResponse.json({ error: `Beta үед өдөрт ${MAX_PER_DAY} видео үүсгэх боломжтой — маргааш дахин ороорой 🌙` }, { status: 429 });
    }

    const preset = MOTION_PRESETS[presetId];
    const fullPrompt = [prompt || "cinematic scene", preset ? `Camera: ${preset.frag}` : ""]
      .filter(Boolean).join(". ");

    const absoluteImage = imageUrl && !imageUrl.startsWith("http")
      ? `${process.env.NEXTAUTH_URL || "https://antaqor.com"}${imageUrl}`
      : imageUrl;

    try {
      const task = await createSeedanceTask({
        tier: engine,
        prompt: fullPrompt,
        imageUrl: absoluteImage || undefined,
        duration: Number(duration),
        aspectRatio: aspectRatio as "16:9" | "9:16" | "1:1",
        resolution: resolution as "480p" | "720p" | "1080p",
      });

      const creation = await AiCreation.create({
        user: user._id, userName: user.name || "", userAvatar: user.avatar || "",
        prompt, presetId: preset ? presetId : "", presetLabel: preset?.label || "",
        fullPrompt, engine, provider: "piapi", resolution,
        inputType: imageUrl ? "image" : "text", imageUrl,
        aspectRatio, duration,
        taskId: task.task_id, taskType: imageUrl ? "image2video" : "text2video",
        status: "processing", cost: 0, isPublic,
      });

      return NextResponse.json({ creation, balance: user.credits ?? null }, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Видео үүсгэж чадсангүй";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
