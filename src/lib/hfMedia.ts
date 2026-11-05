import { config, higgsfield } from "@higgsfield/client/v2";
import { mkdir, writeFile } from "fs/promises";
import { execFile } from "child_process";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { imgModel, imgNorm, imgCost } from "@/lib/agentImageModels";

/* ─── Higgsfield медиа — Antaqor Agent-ийн зураг / видео / Genjutsu (2026-10-24) ──
   lib/higgsfield.ts нь гишүүдийн /tools/video (Seedance) — энэ нь агентын олон
   загварт ерөнхий давхарга: илгээх → request_id → төлөв шалгах → үр дүнг
   /public/uploads руу хадгалах (Higgsfield-ийн CDN холбоос мөнхийн биш).

   Endpoint, оролт, enum бүрийг 2026-10-24-нд API-аас шалгасан (BadInput probe):
     · Soul 2      higgsfield-ai/soul/v2/standard     res 720p|1080p
     · Recraft 4.1 recraft/v4.1/text-to-image         res 1k
     · Ideogram 4  ideogram/v4.0                      rendering_speed TURBO|DEFAULT|QUALITY
     · Wan 3.0 (+Prime) alibaba/wan-3.0[-prime]/{text,image}-to-video  2–30с, 480p|720p|1080p
     · Kling 3.0   kling-video/v3.0/std/{text,image}-to-video  3–15с, 16:9|9:16|1:1, sound on|off
     · Seedance 2.5 bytedance/seedance-2.5/{text,image}-to-video
     · Genjutsu (+Light) higgsfield/genjutsu[-light]/motion-transfer/v1.0  video_url + image_urls[]
   Үнэ = open.higgsfield.ai-ийн ОДООГИЙН (урамшууллын) үнэ, $ — зөвхөн тооцоо/хязгаарт.
   Үр дүн: зураг → images[].url, видео → video.url. HF_CREDENTIALS-ийг хэзээ ч лог хийхгүй. */

export type HfKind = "image" | "video" | "motion" | "edit";
type Build = (o: Opts) => Record<string, unknown>;
export type Opts = { prompt: string; ratio: string; res: string; dur: number; imageUrl?: string; videoUrl?: string; imageUrls?: string[]; audio?: boolean; q?: string };
type Def = {
  id: string; kind: HfKind; label: string; note: string;
  ep: string; epImage?: string; ratios: string[]; res: string[]; durations: number[];
  /** $ — нэгж: зураг бүр, эсвэл секунд (res-ээр) */
  price: Record<string, number>; unit: "img" | "s";
  build: Build;
};

const R_VID = ["9:16", "16:9", "1:1", "4:3", "3:4"];
const imgRatios = (id: string) => imgModel(id)?.ratios || ["1:1"];
/** Медиа студийн жагсаалтад харуулах үнэ — «Сайн» чанараар */
const imgPrice = (id: string) => Object.fromEntries((imgModel(id)?.res || []).map((r) => [r, imgCost(id, r, imgNorm(imgModel(id)!, { res: r }).q)]));
const wan = (o: Opts) => ({ prompt: o.prompt, duration: o.dur, resolution: o.res, aspect_ratio: o.imageUrl ? "adaptive" : o.ratio, generate_audio: o.audio !== false, enable_thinking: false, ...(o.imageUrl ? { image_url: o.imageUrl } : {}) });

export const HF_MODELS: Def[] = [
  /* зураг */
  { id: "soul2", kind: "image", label: "Soul 2", note: "Бодит гэрэл зураг, хүн, lifestyle · хамгийн хямд", ep: "higgsfield-ai/soul/v2/standard", ratios: ["4:3", "3:4", "1:1", "9:16", "16:9", "2:3", "3:2"], res: ["1080p", "720p"], durations: [], price: { "720p": 0.003, "1080p": 0.006 }, unit: "img",
    build: (o) => ({ prompt: o.prompt, batch_size: 1, resolution: o.res, aspect_ratio: o.ratio, enhance_prompt: true }) },
  { id: "recraft", kind: "image", label: "Recraft 4.1", note: "Брэнд иллюстрац, график, цэвэр дизайн", ep: "recraft/v4.1/text-to-image", ratios: ["4:5", "1:1", "3:4", "9:16", "16:9", "4:3", "2:3", "3:2"], res: ["1k"], durations: [], price: { "1k": 0.035 }, unit: "img",
    build: (o) => ({ prompt: o.prompt, resolution: "1k", aspect_ratio: o.ratio, output_format: "jpg" }) },
  { id: "ideogram", kind: "image", label: "Ideogram 4.0", note: "Постер, бичигтэй дизайн (латин бичиг)", ep: "ideogram/v4.0", ratios: ["4:5", "1:1", "3:4", "9:16", "16:9", "4:3", "2:3", "3:2"], res: ["DEFAULT", "QUALITY", "TURBO"], durations: [], price: { DEFAULT: 0.03, QUALITY: 0.03, TURBO: 0.03 }, unit: "img",
    build: (o) => ({ prompt: o.prompt, aspect_ratio: o.ratio, rendering_speed: o.res || "DEFAULT" }) },
  /* «AI зураг» хэсэг (2026-10-24) — чанар (q) + хэмжээ (res) тусдаа; үнэ lib/agentImageModels-оос.
     GPT Image 2 = Marketing Studio 2.0 Alpha, GPT Image 2.5 = Flare (лавлах зураггүй ч зурна). */
  { id: "gpt2", kind: "image", label: "GPT Image 2", note: "ChatGPT-ийн зураг — постер, бичигтэй дизайн", ep: "marketing-studio/image", ratios: imgRatios("gpt2"), res: ["1k", "2k", "4k"], durations: [], price: imgPrice("gpt2"), unit: "img",
    build: (o) => ({ prompt: o.prompt, quality: o.q || "medium", resolution: o.res || "1k", aspect_ratio: o.ratio || "auto", moderation: "auto", enhance_prompt: false, ...(o.imageUrls?.length ? { image_urls: o.imageUrls } : {}) }) },
  { id: "gpt25", kind: "image", label: "GPT Image 2.5", note: "OpenAI-ийн хамгийн шинэ — засвар, бүтээгдэхүүн", ep: "marketing-studio/image/flare", ratios: imgRatios("gpt25"), res: ["1k", "2k", "4k"], durations: [], price: imgPrice("gpt25"), unit: "img",
    build: (o) => ({ prompt: o.prompt, quality: o.q || "medium", resolution: o.res || "1k", aspect_ratio: o.ratio || "auto", ...(o.imageUrls?.length ? { image_urls: o.imageUrls } : {}) }) },
  { id: "grok2", kind: "image", label: "Grok Imagine 2.0", note: "Тод, уран сайхны зураг", ep: "xai/grok-imagine-image-2.0", ratios: imgRatios("grok2"), res: ["1k", "2k"], durations: [], price: imgPrice("grok2"), unit: "img",
    build: (o) => ({ prompt: o.prompt, quality: o.q || "medium", resolution: o.res || "1k", aspect_ratio: o.ratio || "auto", ...(o.imageUrls?.length ? { image_urls: o.imageUrls } : {}) }) },
  { id: "zimage", kind: "image", label: "Z-Image Turbo", note: "Хамгийн хурдан, хямд", ep: "z-image/turbo", ratios: imgRatios("zimage"), res: ["1k", "2k"], durations: [], price: imgPrice("zimage"), unit: "img",
    build: (o) => ({ prompt: o.prompt, resolution: o.res || "1k", aspect_ratio: o.ratio || "1:1" }) },
  /* зураг засах — бодит зургаас (бүтээгдэхүүн салгах, студи, 3D). 2026-10-24 бодит зургаар туршсан:
     Flare (GPT Image 2.5) хувцасны хүрээ, товч, сүлжмэлийг хамгийн үнэнч хадгалсан. */
  { id: "flare", kind: "edit", label: "GPT Image 2.5 · Flare", note: "Хамгийн үнэнч засвар — хувцас, бүтээгдэхүүн салгах", ep: "marketing-studio/image/flare", ratios: ["1:1", "4:5", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"], res: ["medium", "high", "low"], durations: [], price: { low: 0.011, medium: 0.045, high: 0.17 }, unit: "img",
    build: (o) => ({ prompt: o.prompt, image_urls: o.imageUrls, quality: o.res || "medium", resolution: "1k", aspect_ratio: o.ratio === "4:5" ? "3:4" : o.ratio || "1:1" }) },
  { id: "qwenEdit", kind: "edit", label: "Qwen Image 3 Edit", note: "Стилийг хүчтэй өөрчилнө — 3D, CG", ep: "alibaba/qwen-image-3/edit", ratios: ["1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"], res: ["1k", "2k"], durations: [], price: { "1k": 0.04, "2k": 0.075 }, unit: "img",
    build: (o) => ({ prompt: o.prompt, image_urls: o.imageUrls, resolution: o.res || "1k", aspect_ratio: o.ratio === "4:5" ? "3:4" : o.ratio || "1:1", prompt_extend: true, enable_thinking: true, prompt_extend_mode: "direct" }) },
  /* видео */
  { id: "wan3", kind: "video", label: "Wan 3.0", note: "Дуутай, 30с хүртэл · хамгийн хямд видео", ep: "alibaba/wan-3.0/text-to-video", epImage: "alibaba/wan-3.0/image-to-video", ratios: R_VID, res: ["720p", "480p", "1080p"], durations: [5, 8, 10, 15], price: { "480p": 0.02, "720p": 0.04, "1080p": 0.08 }, unit: "s", build: wan },
  { id: "wan3prime", kind: "video", label: "Wan 3.0 Prime", note: "Wan-ийн дээд чанар", ep: "alibaba/wan-3.0-prime/text-to-video", epImage: "alibaba/wan-3.0-prime/image-to-video", ratios: R_VID, res: ["720p", "480p", "1080p"], durations: [5, 8, 10, 15], price: { "480p": 0.0272, "720p": 0.056, "1080p": 0.112 }, unit: "s", build: wan },
  { id: "kling3", kind: "video", label: "Kling 3.0", note: "Олон shot, байгалийн хөдөлгөөн, дуу", ep: "kling-video/v3.0/std/text-to-video", epImage: "kling-video/v3.0/std/image-to-video", ratios: ["9:16", "16:9", "1:1"], res: ["720p"], durations: [5, 10, 15], price: { "720p": 0.042 }, unit: "s",
    build: (o) => ({ prompt: o.prompt, duration: o.dur, sound: o.audio === false ? "off" : "on", cfg_scale: 0.5, multi_shots: false, ...(o.imageUrl ? { image_url: o.imageUrl } : { aspect_ratio: o.ratio }) }) },
  /* Kling 4.0 (2026-10-26, Higgsfield 10/23-нд гаргасан). Endpoint, enum-ийг хоосон/буруу хүсэлтээр
     шалгасан: resolution 720p|1080p, duration бүхэл тоо (3–30), aspect_ratio 21:9|16:9|9:16|1:1
     (image-to-video дээр шаардлагагүй). Үнэ нь 30%-ийн ХЯМДРАЛГҮЙ стандарт ($0.157 / $0.235 /с) —
     урамшуулал дуусахад кредитийн үнэ алдагдалд орохгүй. */
  { id: "kling4", kind: "video", label: "Kling 4.0", note: "Хамгийн шинэ Kling · 1080p, кино шиг хөдөлгөөн", ep: "kling-video/v4.0/text-to-video", epImage: "kling-video/v4.0/image-to-video", ratios: ["16:9", "9:16", "1:1", "21:9"], res: ["720p", "1080p"], durations: [5, 10, 15], price: { "720p": 0.157, "1080p": 0.235 }, unit: "s",
    build: (o) => ({ prompt: o.prompt, duration: o.dur, resolution: o.res, ...(o.imageUrl ? { image_url: o.imageUrl } : { aspect_ratio: o.ratio }) }) },
  { id: "seedance25", kind: "video", label: "Seedance 2.5", note: "Кино чанар · хамгийн үнэтэй", ep: "bytedance/seedance-2.5/text-to-video", epImage: "bytedance/seedance-2.5/image-to-video", ratios: R_VID, res: ["480p", "720p", "1080p"], durations: [5, 8, 10], price: { "480p": 0.144, "720p": 0.32, "1080p": 0.8 }, unit: "s",
    build: (o) => ({ prompt: o.prompt, duration: o.dur, resolution: o.res, generate_audio: o.audio !== false, ...(o.imageUrl ? { image_url: o.imageUrl } : { aspect_ratio: o.ratio }) }) },
  /* Genjutsu — эх видеоны хөдөлгөөнийг зурган дахь дүр/бүтээгдэхүүнд шилжүүлнэ */
  { id: "genjutsuLite", kind: "motion", label: "Genjutsu Lite", note: "Хөдөлгөөн шилжүүлэх · эх видео 15с хүртэл", ep: "higgsfield/genjutsu-light/motion-transfer/v1.0", ratios: [], res: ["720p", "480p", "1080p"], durations: [], price: { "480p": 0.05, "720p": 0.1, "1080p": 0.2 }, unit: "s",
    build: (o) => ({ prompt: o.prompt || "", video_url: o.videoUrl, image_urls: o.imageUrls, resolution: o.res }) },
  { id: "genjutsuSwap", kind: "motion", label: "Genjutsu Lite · Солих", note: "Видеон дахь хувцас/объектыг таны зургаар солино · хөдөлгөөн, дуу хэвээр", ep: "higgsfield/genjutsu-light/object-swap/v1.0", ratios: [], res: ["720p", "480p", "1080p"], durations: [], price: { "480p": 0.05, "720p": 0.1, "1080p": 0.2 }, unit: "s",
    build: (o) => ({ prompt: o.prompt || "", video_url: o.videoUrl, image_urls: o.imageUrls, resolution: o.res }) },
  { id: "genjutsu", kind: "motion", label: "Genjutsu", note: "Дүр, байршил, стиль солих · хамгийн өндөр чанар", ep: "higgsfield/genjutsu/motion-transfer/v1.0", ratios: [], res: ["720p", "480p", "1080p"], durations: [], price: { "480p": 0.159, "720p": 0.34, "1080p": 0.816 }, unit: "s",
    build: (o) => ({ prompt: o.prompt || "", video_url: o.videoUrl, image_urls: o.imageUrls, resolution: o.res }) },
];
/* Genjutsu Lite: billable = гаралт + оролтын видео → секундийн үнийг ×2 гэж тооцсон (дээр). */

export const hfModel = (id: string) => HF_MODELS.find((m) => m.id === id);
export function hfReady(): boolean { return /^[^:\s]+:[^:\s]+$/.test(process.env.HF_CREDENTIALS || ""); }
/** Клиентэд — функцгүй хэлбэр */
export const HF_PUBLIC = HF_MODELS.map(({ build, ...m }) => { void build; return m; });

export function hfCost(id: string, o: { res: string; dur: number; q?: string }): number {
  const m = hfModel(id);
  if (!m) return 0;
  const im = m.kind === "image" ? imgModel(id) : undefined;
  if (im) { const n = imgNorm(im, { res: o.res, q: o.q }); return imgCost(id, n.res, n.q); }
  const unit = m.price[o.res] ?? Object.values(m.price)[0] ?? 0;
  return Math.round((m.unit === "img" ? unit : unit * Math.max(1, o.dur)) * 1000) / 1000;
}

let configured = false;
function ensure() {
  if (!hfReady()) throw new Error("Higgsfield тохируулаагүй (HF_CREDENTIALS)");
  if (!configured) { config({ credentials: process.env.HF_CREDENTIALS }); configured = true; }
}
function human(e: unknown): Error {
  const name = (e as { name?: string })?.name || "", msg = String((e as { message?: string })?.message || e || "");
  if (/NotEnoughCredits|AccountError/i.test(name) || /not enough credits/i.test(msg)) return new Error("Higgsfield данс хоосорсон — cloud.higgsfield.ai дээр цэнэглэнэ үү");
  if (/Authentication/i.test(name)) return new Error("Higgsfield түлхүүр буруу");
  if (/BadInput|Validation/i.test(name)) return new Error(`Higgsfield: ${msg.slice(0, 200)}`);
  return new Error(msg.slice(0, 200) || "Higgsfield хариу өгсөнгүй");
}

export async function hfSubmit(id: string, o: Opts): Promise<{ requestId: string; endpoint: string }> {
  ensure();
  const m = hfModel(id);
  if (!m) throw new Error("Загвар буруу");
  if (m.kind === "motion" && (!o.videoUrl || !o.imageUrls?.length)) throw new Error("Genjutsu-д эх видео + дор хаяж 1 зураг хэрэгтэй");
  if (m.kind === "edit" && !o.imageUrls?.length) throw new Error("Засах зураг алга");
  const endpoint = o.imageUrl && m.epImage ? m.epImage : m.ep;
  try {
    const r = await higgsfield.subscribe(endpoint, { input: m.build(o), withPolling: false } as never) as { request_id?: string };
    if (!r?.request_id) throw new Error("Даалгаврын ID ирсэнгүй");
    return { requestId: r.request_id, endpoint };
  } catch (e) { throw human(e); }
}

export type HfState = { state: "queued" | "running" | "done" | "failed"; url: string; error: string };
export async function hfStatus(requestId: string): Promise<HfState> {
  const res = await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(requestId)}/status`, {
    headers: { Authorization: `Key ${process.env.HF_CREDENTIALS || ""}` }, cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return { state: res.status === 404 ? "failed" : "running", url: "", error: res.status === 404 ? "Даалгавар олдсонгүй" : "" };
  const d = (await res.json()) as { status?: string; images?: { url?: string }[]; image?: { url?: string }; video?: { url?: string }; videos?: { url?: string }[]; error?: string; detail?: string };
  const s = String(d.status || "");
  if (s === "completed") {
    const url = d.video?.url || d.videos?.[0]?.url || d.images?.[0]?.url || d.image?.url || "";
    return url ? { state: "done", url, error: "" } : { state: "failed", url: "", error: "Бэлэн болсон ч холбоос ирсэнгүй" };
  }
  if (s === "nsfw") return { state: "failed", url: "", error: "Агуулгын бодлогоор татгалзсан (moderation) — промптоо өөрчил" };
  if (["failed", "canceled", "cancelled"].includes(s)) return { state: "failed", url: "", error: String(d.error || d.detail || "Үүсгэлт амжилтгүй").slice(0, 200) };
  return { state: s === "in_progress" ? "running" : "queued", url: "", error: "" };
}

const UP = () => path.join(process.cwd(), "public", "uploads");
/** Үр дүнг манай сервер рүү хадгална. Зураг → JPEG (Instagram зөвхөн JPEG авдаг). */
export async function hfSave(url: string, kind: "image" | "video"): Promise<{ url: string; bytes: number }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`Татаж чадсангүй (${r.status})`);
  return saveBuffer(Buffer.from(await r.arrayBuffer()), kind);
}
/** Байт → /public/uploads (Google Nano Banana зэрэг шууд ирсэн зураг) */
export async function saveBuffer(raw: Buffer, kind: "image" | "video"): Promise<{ url: string; bytes: number }> {
  let buf = raw;
  await mkdir(UP(), { recursive: true });
  const name = `agent-hf-${randomUUID()}.${kind === "image" ? "jpg" : "mp4"}`;
  if (kind === "image") buf = await sharp(buf).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toBuffer();
  await writeFile(path.join(UP(), name), buf);
  return { url: `/uploads/${name}`, bytes: buf.length };
}

/** Видеоны урт (сек) — ffprobe. Алдаа гарвал 0. */
export function probeDuration(file: string): Promise<number> {
  return new Promise((res) => {
    execFile("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], { timeout: 20_000 }, (err, out) => res(err ? 0 : Math.round((parseFloat(String(out)) || 0) * 10) / 10));
  });
}
/** Эх видеог 15с хүртэл тайрч (Genjutsu өртгийг хязгаарлана), H.264 mp4 болгоно. */
export function trimVideo(src: string, dst: string, maxSec = 15): Promise<void> {
  return new Promise((res, rej) => {
    execFile("ffmpeg", ["-y", "-i", src, "-t", String(maxSec), "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-c:a", "aac", "-movflags", "+faststart", dst], { timeout: 180_000 }, (err) => (err ? rej(new Error("Видео хөрвүүлж чадсангүй")) : res()));
  });
}
export const siteUrl = (u: string) => (/^https?:/.test(u) ? u : `${(process.env.PUBLIC_SITE_URL || "https://antaqor.com").replace(/\/$/, "")}${u}`);
