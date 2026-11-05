// Antaqor Agent — crontab 5 мин тутам: нийтлэлийн төлөв, цаг тутмын хяналт
// (хэмжүүр, тест, ялагчийг давтах), хуваарийн дүрэм (өдөр бүр 08:00 …).
import { NextRequest, NextResponse } from "next/server";
import { write } from "@/lib/tuqor";
import { agentTick, createVariants, mediaCreate, pollMedia } from "@/lib/agentStudio";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  if (!process.env.CRON_SECRET || q.get("secret") !== process.env.CRON_SECRET) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  /* ?create=N&idea=…&format=post|infographic — студийн туршилт (ноорог л үүснэ, нийтлэхгүй) */
  const c = Number(q.get("create") || 0);
  if (c > 0) {
    const f = q.get("format");
    const r = await createVariants({ source: "idea", text: q.get("idea") || "", format: f === "infographic" || f === "image" || f === "video" ? f : "post", count: Math.min(5, c), theme: (q.get("theme") as "light" | "dark" | "brand") || "light", media: { model: q.get("model") || undefined, dur: Number(q.get("dur")) || undefined, res: q.get("res") || undefined } });
    return NextResponse.json({ ok: true, group: r.group, posts: r.posts.map((p) => ({ id: String(p._id), angle: p.angle, kind: p.kind, imageUrl: p.imageUrl, pred: p.pred.score, novelty: p.pred.novelty, hold: p.holdReason, fixes: p.fixes, generic: p.generic, text: p.text })) });
  }
  /* ?mediatest=<model>&prompt=… — медиа студи (Higgsfield, мөнгө зарна); ?poll=1 — төлөв шалгах */
  if (q.get("mediatest")) return NextResponse.json({ ok: true, ...(await mediaCreate({ model: q.get("mediatest")!, prompt: q.get("prompt") || "", enhance: q.get("enhance") !== "0", ratio: q.get("ratio") || undefined, res: q.get("res") || undefined, dur: Number(q.get("dur")) || undefined })) });
  if (q.get("poll")) return NextResponse.json({ ok: true, ...(await pollMedia()) });
  const w = Number(q.get("write") || 0);
  if (w > 0) {
    const idea = q.get("idea");
    const made = idea !== null ? await write({ source: "idea", idea, count: Math.min(6, w) }) : await write({ source: "auto", count: Math.min(6, w), day: new Date(Date.now() + 864e5) });
    return NextResponse.json({ ok: true, made: made.map((p) => ({ at: p.at, format: p.format, status: p.status, holdReason: p.holdReason, pred: p.pred.score, text: p.text })) });
  }
  return NextResponse.json({ ok: true, ...(await agentTick()) });
}
