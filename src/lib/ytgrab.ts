import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import YtJob, { IYtJob } from "@/models/YtJob";
import YtAgent, { IYtAgent } from "@/models/YtAgent";

/* ─── YTGRAB — серверийн хуваалцсан хэсэг ───────────────────────────────
   Татац нь ЭНД БИШ, хэрэглэгч тус бүрийн машин дээрх agent-д гүйнэ.
   Энэ файл нь холбоосын шалгуур, agent-ийн нэвтрэлт, гацсан ажил. */

/* Зөвшөөрөгдсөн хост. Агуулга нь ямар ч үед shell-д орохгүй — agent нь
   yt-dlp-ийг массив аргументаар л дууддаг. */
const HOSTS = new Set([
  "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "youtube-nocookie.com",
  "tiktok.com", "vm.tiktok.com",
  "instagram.com", "facebook.com", "fb.watch",
  "vimeo.com", "player.vimeo.com",
  "x.com", "twitter.com",
]);

export const HEIGHTS = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];
export const MP3_KBPS = [128, 192, 320];
/* MP3 горим agent 1.1-ээс эхэлсэн — хуучин agent mp3 ажлыг видео гэж ойлгоно. */
export const MP3_MIN_AGENT = 1.1;
export const agentVer = (v: string | undefined) => Number(String(v || "").match(/^\d+(\.\d+)?/)?.[0] || 0);

export function checkUrl(raw: unknown): string {
  let u: URL;
  try { u = new URL(String(raw ?? "").trim()); }
  catch { throw new Error("Холбоос буруу байна."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Зөвхөн http эсвэл https холбоос.");
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!HOSTS.has(host)) throw new Error("Дэмжээгүй сайт: " + host);
  return u.toString();
}

/* ─── Agent-ийн нэвтрэлт ────────────────────────────────────────────────
   Хэрэглэгч тус бүр ӨӨРИЙН нууцтай. Нууцыг түүхийгээр хадгалахгүй —
   sha256-аар л хайна, тиймээс мэдээллийн сан гартаа ч нууц гарахгүй.
   Нэг орчны нийт нууц байхгүй: хэрэглэгч А-ын agent хэрэглэгч Б-ийн
   ажлыг хэзээ ч авч чадахгүй (claim нь user-аар шүүнэ). */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function resolveAgent(headerValue: string | null): Promise<IYtAgent | null> {
  const raw = (headerValue || "").trim();
  /* 64 hex-ээс өөр юм бол сан хүртэл явуулахгүй. */
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;
  return YtAgent.findOne({ tokenHash: hashToken(raw.toLowerCase()) });
}

/* ─── Гацсан ажил ───────────────────────────────────────────────────────
   Agent нь дундаа унтарч магад (машин унтсан, процесс алагдсан). Тэр үед
   ажил "working" хэвээр үүрд хэвтэхээс сэргийлж, уншихдаа л алдаа
   болгоно. Cron шаардахгүй.

   Гацсан ажлын КРЕДИТИЙГ БУЦААНА. `refunded` туг нь хоёр удаа буцаахыг
   хориглоно — энэ бол хэрэглэгчийн мөнгө, "магадгүй" гэж орхиж болохгүй. */
const STALL_PROBE_MS = 90_000;
const STALL_FETCH_MS = 20 * 60_000;

export const STALL_MSG = "Холбоо тасарлаа — agent ажиллаж байгаа эсэхийг шалга.";

export async function failStalled(): Promise<void> {
  const now = Date.now();
  const stale = await YtJob.find({
    status: "working",
    $or: [
      { kind: "probe", updatedAt: { $lt: new Date(now - STALL_PROBE_MS) } },
      { kind: "fetch", updatedAt: { $lt: new Date(now - STALL_FETCH_MS) } },
    ],
  });

  for (const j of stale) {
    j.status = "error";
    j.error = STALL_MSG;
    await refundJob(j);
    await j.save();
  }
}

/* Татац бүтээгүй бол кредитийг эгүүлнэ. Дуудагч нь `save()`-ыг өөрөө
   хийнэ — ингэснээр нэг бичилтээр дүн ба туг хоёр хамт тогтоно. */
export async function refundJob(j: IYtJob): Promise<void> {
  if (j.kind !== "fetch" || !j.charged || j.refunded || !j.user) return;
  const { refundCredits } = await import("@/lib/credits");
  /* refundCredits нь `meta` хүлээж авдаггүй — ажлын id нь `ref` дээр. */
  await refundCredits({
    userId: String(j.user),
    amount: j.charged,
    reason: "YT_DOWNLOAD_REFUND",
    ref: String(j._id),
  });
  j.refunded = true;
}

/* Сервер дээр хуулсан файл НИЙТИЙН хавтсанд биш. `public/uploads` нь
   nginx-ээр шууд дамждаг тул тэнд байрлуулбал хаягийг таамаглаад хэн ч
   авч болно. Эндээс зөвхөн эзэн нь, нэвтэрсэн маршрутаар авна. */
export const YT_DIR = "/var/www/antaqor/.ytfiles";

export function storedPath(jobId: string): string {
  /* jobId нь ObjectId — зөвхөн 24 hex. Замын дайралт боломжгүй болгоно. */
  if (!/^[a-f0-9]{24}$/i.test(jobId)) throw new Error("id буруу");
  return path.join(YT_DIR, jobId + ".mp4");
}

/* Нэг хоногоос хэтэрсэн файлыг цэвэрлэнэ. Cron үүсгэхгүй — хуудас
   нээгдэх үед л гүйнэ, тэр нь хангалттай. */
const KEEP_MS = 24 * 60 * 60_000;

export async function sweepFiles(): Promise<void> {
  let names: string[];
  try { names = await fs.readdir(YT_DIR); } catch { return; }
  const cutoff = Date.now() - KEEP_MS;
  for (const name of names) {
    const p = path.join(YT_DIR, name);
    try {
      const st = await fs.stat(p);
      if (st.mtimeMs < cutoff) {
        await fs.unlink(p);
        const id = name.replace(/\.mp4$/, "");
        if (/^[a-f0-9]{24}$/i.test(id)) await YtJob.updateOne({ _id: id }, { $set: { stored: false } });
      }
    } catch { /* дараагийнх */ }
  }
}

/* Клиент руу гарах хэлбэр. `url` хэрэггүй тул гаргахгүй. */
export function publicJob(j: IYtJob) {
  return {
    id: String(j._id),
    kind: j.kind,
    status: j.status,
    pct: j.pct,
    stage: j.stage,
    mode: j.mode,
    abr: j.abr || 0,
    runner: j.runner || "agent",
    height: j.height,
    title: j.title || j.info?.title || "",
    info: j.info || null,
    fileName: j.fileName,
    fileSize: j.fileSize,
    macPath: j.macPath,
    wantUpload: j.wantUpload,
    stored: j.stored,
    charged: j.charged,
    error: j.error,
    createdAt: j.createdAt,
  };
}
