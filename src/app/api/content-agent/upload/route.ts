import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { wsContext } from "@/lib/agentWs";
import { probeDuration, trimVideo } from "@/lib/hfMedia";

/* Antaqor Agent — медиа студийн лавлах файл (эхлэх зураг, Genjutsu-гийн эх видео, дүр).
   Higgsfield нийтэд хүрэх URL шаарддаг тул /public/uploads/agent-ref-* руу хадгална.
   Видео: 15с хүртэл тайрч H.264 mp4 болгоно (Genjutsu-гийн өртөг оролтын секундээр). */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const c = await wsContext(req);
  if (!c) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  /* онбординг дээр лого оруулж болно (ws хараахан алга) — видео workspace шаардана */
  const form = await req.formData().catch(() => null);
  const f = form?.get("file");
  if (!f || typeof f === "string") return NextResponse.json({ error: "Файл алга" }, { status: 400 });
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const id = randomUUID();
  const buf = Buffer.from(await f.arrayBuffer());
  try {
    if (f.type.startsWith("image/")) {
      if (buf.length > 25 * 1024 * 1024) return NextResponse.json({ error: "Зураг 25MB-аас бага байх ёстой" }, { status: 400 });
      const jpg = await sharp(buf).rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
      await writeFile(path.join(dir, `agent-ref-${id}.jpg`), jpg);
      return NextResponse.json({ ok: true, kind: "image", url: `/uploads/agent-ref-${id}.jpg` });
    }
    if (f.type.startsWith("video/")) {
      if (!c.ws) return NextResponse.json({ error: "Эхлээд бизнесээ бүртгүүлнэ үү" }, { status: 400 });
      if (buf.length > 300 * 1024 * 1024) return NextResponse.json({ error: "Видео 300MB-аас бага байх ёстой" }, { status: 400 });
      const tmp = path.join(tmpdir(), `agent-ref-${id}.src`);
      const out = path.join(dir, `agent-ref-${id}.mp4`);
      await writeFile(tmp, buf);
      try { await trimVideo(tmp, out, 15); } finally { await unlink(tmp).catch(() => {}); }
      const dur = await probeDuration(out);
      if (!dur) { await unlink(out).catch(() => {}); return NextResponse.json({ error: "Видео уншиж чадсангүй" }, { status: 400 }); }
      return NextResponse.json({ ok: true, kind: "video", url: `/uploads/agent-ref-${id}.mp4`, dur });
    }
    return NextResponse.json({ error: "Зөвхөн зураг эсвэл видео" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Хадгалж чадсангүй" }, { status: 500 });
  }
}
