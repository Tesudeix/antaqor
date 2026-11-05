// ─── Higgsfield (Seedance 2.5) — AI видеоны үйлчилгээ үзүүлэгч (2026-10-13) ──
//
// /tools/video өмнө нь BytePlus ModelArk-ийг ШУУД дууддаг байсан (lib/seedance).
// Одоо Higgsfield-ээр дамжина — ижил Seedance 2.5 загвар, нэг данс, нэг түлхүүр.
// Энэ модуль нь seedance.ts-тэй ИЖИЛ хэлбэрийн гурван функц өгнө, тэгснээр
// кредит авах/буцаах, түүх, статусын урсгал огт өөрчлөгдөхгүй:
//
//   createVideoTask → request_id   (хүлээхгүй — withPolling:false)
//   getTask(id)     → queued | running | succeeded | failed (+ videoUrl)
//   downloadOutput  → lib/seedance-ийнхийг дахин ашиглана (энгийн fetch)
//
// Баримт (2026-10-13-нд уншсан): docs.higgsfield.ai/docs/how-to/sdk,
// open.higgsfield.ai/models/bytedance/seedance-2.5/{text,image}-to-video.
//   · text-to-video:  prompt, duration 4–30, resolution 480p|720p|1080p,
//                     aspect_ratio 16:9|4:3|1:1|3:4|9:16|21:9, generate_audio
//   · image-to-video: image_url (ЗААВАЛ, URL — base64 биш), end_image_url,
//                     aspect_ratio БАЙХГҮЙ (зургийн харьцааг дагана)
//   · статус: queued | in_progress | completed | failed | nsfw (+canceled)
//   · үр дүн: { video: { url } }
// HF_CREDENTIALS = "key-id:key-secret" — зөвхөн сервер, хэзээ ч лог хийхгүй.

import { config, higgsfield } from "@higgsfield/client/v2";

const API = "https://api.higgsfield.ai";

export class HiggsfieldError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export function higgsfieldConfigured(): boolean {
  return /^[^:\s]+:[^:\s]+$/.test(process.env.HF_CREDENTIALS || "");
}

let configured = false;
function ensureConfig() {
  if (configured) return;
  config({ credentials: process.env.HF_CREDENTIALS });
  configured = true;
}

/** SDK-ийн алдааг гишүүнд ойлгомжтой Монгол мессеж болгоно. */
function humanize(e: unknown): HiggsfieldError {
  const name = (e as { name?: string })?.name || "";
  const msg = String((e as { message?: string })?.message || e || "");
  if (/NotEnoughCredits|AccountError/i.test(name) || /not enough credits/i.test(msg))
    return new HiggsfieldError("Видео үйлчилгээний данс түр хоосорсон байна. Админд мэдэгдлээ — удахгүй сэргэнэ.", 503);
  if (/Authentication/i.test(name)) return new HiggsfieldError("Видео үйлчилгээний тохиргооны алдаа (түлхүүр).", 503);
  if (/BadInput|Validation/i.test(name)) return new HiggsfieldError(`Буруу тохиргоо: ${msg.slice(0, 160)}`, 400);
  return new HiggsfieldError(msg.slice(0, 200) || "Видео үйлчилгээ хариу өгсөнгүй", 502);
}

export async function createVideoTask(args: {
  promptText: string;
  /** Нийтэд хүрэх https URL (data: URI биш). Байвал image-to-video. */
  imageUrl?: string;
  ratio: string;
  duration: number;
  resolution: string;
  generateAudio: boolean;
}): Promise<{ taskId: string }> {
  ensureConfig();
  const endpoint = args.imageUrl
    ? "bytedance/seedance-2.5/image-to-video"
    : "bytedance/seedance-2.5/text-to-video";
  const input: Record<string, unknown> = {
    prompt: args.promptText,
    duration: args.duration,
    resolution: args.resolution,
    generate_audio: args.generateAudio,
  };
  if (args.imageUrl) input.image_url = args.imageUrl;
  else input.aspect_ratio = args.ratio;

  try {
    const r = await higgsfield.subscribe(endpoint, { input, withPolling: false });
    if (!r?.request_id) throw new HiggsfieldError("Даалгаврын ID ирсэнгүй", 502);
    return { taskId: r.request_id };
  } catch (e) {
    if (e instanceof HiggsfieldError) throw e;
    throw humanize(e);
  }
}

export interface HiggsfieldTask {
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl: string;
  failure: string;
}

export async function getTask(taskId: string): Promise<HiggsfieldTask> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${API}/requests/${encodeURIComponent(taskId)}/status`, {
      headers: { Authorization: `Key ${process.env.HF_CREDENTIALS || ""}` },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch {
    throw new HiggsfieldError("Төлөв шалгаж чадсангүй", 504);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new HiggsfieldError(`Төлөв HTTP ${res.status}`, res.status);
  const d = (await res.json()) as { status?: string; video?: { url?: string }; error?: string; detail?: string };
  const s = String(d.status || "");
  if (s === "completed") {
    const url = d.video?.url || "";
    return url
      ? { status: "succeeded", videoUrl: url, failure: "" }
      : { status: "failed", videoUrl: "", failure: "Видео бэлэн болсон ч холбоос ирсэнгүй" };
  }
  if (s === "nsfw") return { status: "failed", videoUrl: "", failure: "Агуулгын бодлогын улмаас татгалзсан (moderation). Промптоо өөрчлөөд дахин оролдоно уу." };
  if (s === "failed" || s === "canceled" || s === "cancelled") {
    return { status: "failed", videoUrl: "", failure: d.error || d.detail || "Видео үүсгэлт амжилтгүй" };
  }
  return { status: s === "in_progress" ? "running" : "queued", videoUrl: "", failure: "" };
}
