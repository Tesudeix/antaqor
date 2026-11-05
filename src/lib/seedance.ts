import { Buffer } from "buffer";

// ─── BytePlus ModelArk — Dreamina Seedance видео үүсгэлт ───
//
// Seedance-ыг өмнө нь ГУРАВДАГЧ дамжуулагчаар дууддаг байсан бөгөөд тэр
// нь өөрийн маржинаа нэмдэг — 2026-09-03-нд хэмжихэд 5 секундын бичлэг
// 145 гуравдагч кредит зарцуулж байв. Энэ файл нь эх сурвалж руу ШУУД
// холбогдоно; дамжуулагч бүрэн хасагдсан (2026-09-22).
//
// Гэрээ — 2026-09-22-нд баримтаас нүдээр баталгаажсан:
//   POST   /api/v3/contents/generations/tasks        -> { id }
//   GET    /api/v3/contents/generations/tasks/{id}   -> { status, content.video_url, ... }
//   GET    /api/v3/contents/generations/tasks?...    -> { items, total }
//   DELETE /api/v3/contents/generations/tasks/{id}   -> цуцлах ЭСВЭЛ устгах
//
// ХОЁР ХУГАЦААНЫ ХЯЗГААР — энэ хоёрыг мартвал видео чимээгүй алга болно:
//   · Видеоны URL нь 24 ЦАГ хүчинтэй. Тиймээс URL-ийг ХАДГАЛАХГҮЙ,
//     татаж авч өөрийн /uploads руу тавина.
//   · Даалгаврын түүх 7 ХОНОГ. Түүнээс хойш статус ч асуух боломжгүй.

const BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
const TIMEOUT_MS = 60_000;

export class SeedanceError extends Error {
  status: number;
  code: string;
  /** Ханган нийлүүлэгчийн ТҮҮХИЙ текст — ЗӨВХӨН лог руу.
   *  Гишүүнд хэзээ ч бүү үзүүл: дотор нь BytePlus дансны дугаар,
   *  request id зэрэг бидний дотоод мэдээлэл явдаг. */
  detail: string;
  constructor(message: string, status = 502, code = "", detail = "") {
    super(message);
    this.name = "SeedanceError";
    this.status = status;
    this.code = code;
    this.detail = detail || message;
  }
}

/* ModelArk-ийн алдааг ГИШҮҮНИЙ хэлээр. Гурван ангилал:
     · бидний тохиргоо буруу  → гишүүн юу ч хийж чадахгүй, 503
     · гишүүний оролт буруу   → гишүүн засаж чадна, 400
     · түр зуурын             → дахин оролдоно, 429/502
   Буцаах HTTP статусыг ч ЭНД шийднэ: `ModelNotOpen` нь 404 ирдэг ч
   гишүүнд 404 гэж хэлэх нь худал — хуудас олдсон, үйлчилгээ л бэлэн
   биш. */
function memberFacing(code: string, status: number): { msg: string; status: number } {
  const c = code.toLowerCase();

  // Тохиргоо / эрх / төлбөр — админы асуудал.
  if (/modelnotopen|modelnotfound|accessdenied|authentication|invalidapikey|quota|balance|overdue|notactivate/.test(c)) {
    return { msg: "AI видео түр боломжгүй. Админ тохиргоог шалгаж байна.", status: 503 };
  }
  // Агуулгын шүүлт — гишүүн промптоо засаж болно.
  if (/sensitive|moderation|risk|policy/.test(c)) {
    return { msg: "Промпт зөвшөөрөгдөхгүй агуулгатай байна. Өөрчилж үзнэ үү.", status: 400 };
  }
  // Хурдны хязгаар.
  if (/ratelimit|toomany/.test(c) || status === 429) {
    return { msg: "Дэндүү олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.", status: 429 };
  }
  // Оролтын алдаа.
  if (/invalid|param|badrequest/.test(c) || status === 400) {
    return { msg: "Хүсэлт буруу байна. Загвар, харьцаа, хугацаагаа шалгана уу.", status: 400 };
  }
  return { msg: "Видео үүсгэж чадсангүй. Дахин оролдоно уу.", status: status >= 500 ? 502 : 502 };
}

export function seedanceKey(): string {
  const k = process.env.ARK_API_KEY || "";
  if (!k) throw new SeedanceError("ARK_API_KEY тохируулагдаагүй", 500, "no_key");
  return k;
}

export function seedanceConfigured(): boolean {
  return Boolean(process.env.ARK_API_KEY);
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${seedanceKey()}`,
    "Content-Type": "application/json",
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: authHeaders(), signal: ctrl.signal });
  } catch (e) {
    throw new SeedanceError(
      e instanceof Error && e.name === "AbortError" ? "Хугацаа дууслаа" : "Сүлжээний алдаа",
      504
    );
  } finally {
    clearTimeout(t);
  }

  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* JSON биш */ }

  if (!res.ok) {
    const e = (json as { error?: { message?: string; code?: string } } | null)?.error;
    const raw = e?.message || `ModelArk HTTP ${res.status}`;
    const code = e?.code || "";
    // Оношлогоо нь ЛОГ дээр бүтнээрээ үлдэнэ — админ энд хардаг.
    console.error(`[seedance] ${res.status} ${code || "(no code)"} · ${raw}`);
    const m = memberFacing(code, res.status);
    throw new SeedanceError(m.msg, m.status, code, raw);
  }
  return (json || {}) as T;
}

/* Цуцлах баримтын хүснэгтээс баталгаажсан бүрэн жагсаалт. */
/* Баримтжсан төлөв: queued | running | cancelled | succeeded | failed.
   `expired` нь баримтад БАЙХГҮЙ ч даалгаврын түүх 7 хоногийн дараа
   алга болдог тул хамгаалалт болгон үлдээв — status маршрут үүнийг
   эцсийн төлөв гэж үзэж кредитийг буцаана. */
export type SeedanceStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";

export interface SeedanceTask {
  id: string;
  status: SeedanceStatus;
  /** Зөвхөн succeeded үед. 24 ЦАГИЙН дараа үхнэ — шууд татаж ав. */
  videoUrl: string;
  failure: string;
  failureCode: string;
  /** ModelArk ЯВЦЫН ХУВЬ БУЦААДАГГҮЙ.
      Зохиож бичих нь худал тул ҮРГЭЛЖ 0. Дэлгэц дээр "Дараалалд"
      гэж гарах бөгөөд тэр нь бидний үнэхээр мэддэг хэмжээ. */
  progress: number;
  /** Жинхэнэ өртгийн ганц хэмжүүр: ModelArk токеноор тооцдог. */
  totalTokens: number;
  durationSec: number;
}

export interface CreateVideoArgs {
  /** ModelArk-ийн загварын ID, ж: "dreamina-seedance-2-0-260128" */
  model: string;
  promptText: string;
  /** Байвал зургаас видео. Нийтийн https URL эсвэл data: URI. */
  promptImage?: string;
  /** "16:9" | "9:16" | "1:1" | "adaptive" — "1280:720" хэлбэр БИШ.
   *  Эхлэх зурагтай үед `adaptive` байх ЁСТОЙ (баримтын шаардлага). */
  ratio: string;
  /** "480p" | "720p" | "1080p" */
  resolution: string;
  duration: number;
  /** Seedance дуу ҮҮСГЭЖ ЧАДНА. ModelArk-ийн анхдагч нь `true` тул
   *  дуугүй хүсвэл ЗААВАЛ `false` илгээнэ. */
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export async function createVideoTask(a: CreateVideoArgs): Promise<{ taskId: string }> {
  const content: ContentPart[] = [{ type: "text", text: a.promptText }];
  if (a.promptImage) {
    /* Эхний кадрын `role`-ыг ЗОРИУД тавиагүй: баримтын "Image to video"
       жишээ таб залхуу ачаалалттай тул би түүнийг нүдээр баталж чадсангүй,
       харин суурь хэлбэр нь баримтжсан. Эхний бодит дуудлагын дараа
       шаардлагатай бол `role` нэмнэ. */
    content.push({ type: "image_url", image_url: { url: a.promptImage } });
  }

  const body: Record<string, unknown> = {
    model: a.model,
    content,
    ratio: a.ratio,
    resolution: a.resolution,
    duration: a.duration,
    watermark: a.watermark ?? false,
  };
  if (typeof a.generateAudio === "boolean") body.generate_audio = a.generateAudio;
  if (typeof a.seed === "number") body.seed = a.seed;

  const r = await call<{ id?: string }>("/contents/generations/tasks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.id) throw new SeedanceError("ModelArk даалгавар үүсгэсэнгүй", 502);
  return { taskId: r.id };
}

export async function getTask(taskId: string): Promise<SeedanceTask> {
  const r = await call<{
    id?: string;
    status?: string;
    content?: { video_url?: string };
    error?: { message?: string; code?: string } | null;
    usage?: { total_tokens?: number };
    duration?: number;
  }>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`, { method: "GET" });

  return {
    id: r.id || taskId,
    status: (r.status || "queued") as SeedanceStatus,
    videoUrl: r.content?.video_url || "",
    failure: r.error?.message || "",
    failureCode: r.error?.code || "",
    progress: 0,
    totalTokens: Number(r.usage?.total_tokens) || 0,
    durationSec: Number(r.duration) || 0,
  };
}

/** Нэг эндпойнт хоёр үүрэгтэй: `queued` бол ЦУЦАЛНА, `succeeded`/`failed`/
 *  `expired` бол бичлэгийг УСТГАНА. `running` ба `cancelled` үед ажиллахгүй. */
export async function cancelOrDeleteTask(taskId: string): Promise<void> {
  await call<unknown>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

/** Бэлэн видеог татна. URL нь 24 цагийн дараа үхэх тул ЗААВАЛ дуудна. */
export async function downloadOutput(url: string): Promise<{ buf: Buffer; mime: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch {
    throw new SeedanceError("Видео татаж чадсангүй", 504);
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new SeedanceError(`Видео татахад HTTP ${res.status}`, res.status);

  const ab = await res.arrayBuffer();
  if (ab.byteLength > MAX_VIDEO_BYTES) {
    throw new SeedanceError("Видео хэт том", 413);
  }
  return {
    buf: Buffer.from(ab),
    mime: res.headers.get("content-type") || "video/mp4",
  };
}
