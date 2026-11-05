// ─── AI видео үнэ — студи, маршрут, админд НЭГ каталог ──────────────────
//
// `src/lib/imagePricing.ts`-ийн видео хувилбар. Клиентэд аюулгүй (сервер
// импорт байхгүй) тул хуудас ижил тодорхойлолтоос уншиж, API ижил
// тодорхойлолтоор төлбөр авна — хоёр нь хэзээ ч зөрөхгүй.
//
// ⚠ АНХДАГЧ ҮНИЙГ ТААМАГЛАЖ БИЧИЖ БОЛОХГҮЙ. Antaqor-ийн ханш 100₵ =
//   ₮5,000 (≈ $1.45). ModelArk нь ТОКЕНООР тооцдог бөгөөд даалгавар
//   үүсгэхэд өртгийн таамаг буцаадаггүй — жинхэнэ өртөг нь дуусахад
//   `usage.total_tokens` болж ирнэ. Мөр бүр түүнийг `providerTokens`
//   талбартаа хадгалдаг тул үнэн маржин ХЭМЖИЛТЭЭР хуримтлагдана.
//   Доорх секунд тутмын тоо нь ЭХЛЭХ цэг — хэдэн арван видео үүсмэгц
//   `providerTokens`-ийн дунджаар шалгаад /admin-аас засна.
//
// ДУУ (generate_audio): ModelArk дуутай видеог илүү токен зарцуулдаг ч
//   нийтэлсэн үржүүлэгч алга. Тиймээс ЭНД дуу нь үнийг өөрчлөхгүй —
//   зохиомол тоо бичихийн оронд эхлээд хэмжинэ. Дуутай/дуугүй мөрүүдийн
//   `providerTokens` хуваагдмал болмогц энэ шийдвэрийг дахин хийнэ.

export type VideoModelId = "seedance25" | "seedance20";
/** `adaptive` нь ModelArk-ийн утга: оролтын дагуу харьцааг өөрөө сонгоно. */
export type VideoRatioId = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "adaptive";

export interface VideoModelDef {
  id: VideoModelId;
  label: string;
  sub: string;
  /** ModelArk-ийн загварын ID — утсан дээр энэ явна. */
  providerModel: string;
  /** Seedance нь харьцаа, НАРИЙВЧЛАЛЫГ ТУСДАА авдаг. */
  resolution: string;
  /** Эхлэх зураг дэмждэг эсэх (image to video). */
  supportsImage: boolean;
  /** Дуу үүсгэж чадах эсэх (`generate_audio`). */
  supportsAudio: boolean;
  /** Дэмжигдсэн харьцаа. Seedance-д утга нь өөртэйгөө ижил. */
  ratios: Record<string, string>;
  /** Зөвшөөрөгдсөн үргэлжлэх хугацаа (секунд). */
  durations: number[];
  /** Секунд тутмын анхдагч кредит үнэ. Админ дарж бичнэ. */
  creditsPerSecond: number;
  settingKey: "vidCostSeedance25" | "vidCostSeedance20";
}

/* ЗАГВАРЫН ID БА ХЯЗГААР — 2026-09-22-нд ModelArk-ийн баримтаас нүдээр
   баталгаажуулсан (docs.byteplus.com/en/docs/ModelArk/1520757 ба 1521309):

     · `dreamina-seedance-2-5-260628` — "Create a video generation task"
       хуудасны cURL жишээнд яг ийм бичигтэй.
     · `dreamina-seedance-2-0-260128` — "Retrieve a video generation task"
       хуудасны хариуны жишээнд яг ийм бичигтэй.
     · resolution: 2.5 → 480p/720p/1080p, 2.0 → 480p/720p/1080p/4k.
     · duration:   2.5 → [4,30] эсвэл -1, 2.0 → [4,15] эсвэл -1.
     · ratio:      16:9, 4:3, 1:1, 3:4, 9:16, 21:9, adaptive.

   "mini"/"fast" хувилбарууд үнийн хуудсанд дурдагдсан ч ID нь баримтад
   гараагүй тул ЭНД ЗОХИОГҮЙ — буруу ID бол шууд API алдаа. Шинэ загвар
   нэмэх бол ModelArk консолоос ID-г нь хуулж ав.

   Доорх `durations` нь зөвшөөрөгдсөн мужийн ДОТОРХ хоёр цэг: сонголтыг
   энгийн байлгах үүднээс. Муж өөрөө үүнээс өргөн.

   Нэг загварыг env-ээр дарж болно: шинэ хувилбар гармагц кодыг дахин
   байрлуулахгүйгээр туршихын тулд. */
/* 2026-10-13: ҮЙЛЧИЛГЭЭ ҮЗҮҮЛЭГЧ = HIGGSFIELD (lib/higgsfield.ts). Seedance 2.5
   ганцаараа — Higgsfield дээр 2.0 байхгүй. `providerModel` нь зөвхөн тайлбар
   (AiVideo мөрөнд хадгалагдана); endpoint-ийг higgsfield.ts сонгоно. */
export const VIDEO_MODELS: VideoModelDef[] = [
  {
    id: "seedance25",
    label: "Seedance 2.5",
    sub: "Кино маягийн · дуутай · зурагнаас ч болно",
    providerModel: "higgsfield/bytedance/seedance-2.5",
    resolution: "720p",
    supportsImage: true,
    supportsAudio: true,
    ratios: { "16:9": "16:9", "9:16": "9:16", "1:1": "1:1", "4:3": "4:3", "3:4": "3:4", "21:9": "21:9" },
    durations: [5, 8, 10, 15],
    creditsPerSecond: 30,
    settingKey: "vidCostSeedance25",
  },
];

/** Нарийвчлал ба үнийн үржүүлэгч (720p = суурь). */
export const VIDEO_RESOLUTIONS: { id: string; label: string; mult: number }[] = [
  { id: "480p", label: "480p", mult: 0.6 },
  { id: "720p", label: "720p", mult: 1 },
  { id: "1080p", label: "1080p", mult: 1.8 },
];
export function resolveResolution(r: string): string {
  return VIDEO_RESOLUTIONS.some((x) => x.id === r) ? r : "720p";
}

export function findVideoModel(id: string): VideoModelDef | undefined {
  return VIDEO_MODELS.find((m) => m.id === id);
}

/** Шошго харуулах шаардлагатай бүх газарт нэг эх сурвалж. */
/* ─── ӨРТӨГТ СУУРИЛСАН ҮНЭ (2026-10-13, эзний шийдвэр) ─────────────────────
   Higgsfield Seedance 2.5 нь ТОКЕНООР тооцдог (open.higgsfield.ai, 2026-10-13):
     tokens = ceil(W × H × секунд × 24 / 1024)
     $0.0214 / 1000 токен (480p, 720p) · $0.0234 / 1000 токен (1080p)
   → 720p 16:9 5с = 108,000 токен = $2.31.
   Кредит = ceil( өртөг$ × FX ÷ (хамгийн хямд багцын ₮/кредит) × (1 + margin) ).
   Хамгийн хямд багц (Empire ₮24) дээр ч 25% ашигтай — ямар ч багцаар алдагдалгүй.
   FX/суурь/margin өөрчлөгдвөл ЗӨВХӨН ЭНД. */
export const VIDEO_COST_MODEL = {
  usdPer1kTokens: { "480p": 0.0214, "720p": 0.0214, "1080p": 0.0234 } as Record<string, number>,
  fxMntPerUsd: 3580,
  creditBasisMnt: 1 / 1.3, // 2026-10-26: 1кр=₮1, хамгийн их бонус +30% → ₮0.769/кр
  margin: 0.25,
};

/** Гаралтын хэмжээ: богино тал = нарийвчлал; `adaptive` (зурагтай) → хамгийн том нь (16:9). */
export function videoDims(resolution: string, ratio: string): { w: number; h: number } {
  const short = resolution === "480p" ? 480 : resolution === "1080p" ? 1080 : 720;
  const [a, b] = (ratio && ratio !== "adaptive" ? ratio : "16:9").split(":").map(Number);
  if (!a || !b) return { w: Math.round((short * 16) / 9), h: short };
  return a >= b ? { w: Math.round((short * a) / b), h: short } : { w: short, h: Math.round((short * b) / a) };
}

/** Үйлчилгээ үзүүлэгчийн өртөг (USD) — тайлан, багцын тооцоонд. */
export function videoProviderUsd(duration: number, resolution = "720p", ratio = "16:9"): number {
  const { w, h } = videoDims(resolution, ratio);
  const tokens = Math.ceil((w * h * Math.max(1, duration) * 24) / 1024);
  return (tokens / 1000) * (VIDEO_COST_MODEL.usdPer1kTokens[resolution] ?? 0.0214);
}

export interface VideoPricing {
  /** ХУУЧИН (админ ContentStudio уншдаг): 720p 16:9-ийн секунд тутмын ойролцоо кредит. */
  perSecond: Record<VideoModelId, number>;
}

export function defaultVideoPricing(): VideoPricing {
  const perSecond = {} as Record<VideoModelId, number>;
  for (const m of VIDEO_MODELS) perSecond[m.id] = Math.ceil(videoCreditCost({ perSecond } as VideoPricing, m.id, 5) / 5);
  return { perSecond };
}

/** Нийт үнэ = секундын үнэ × хугацаа. Хамгийн багадаа 1 кредит. */
export function videoCreditCost(_pricing: VideoPricing, _modelId: VideoModelId, duration: number, resolution = "720p", ratio = "16:9"): number {
  const usd = videoProviderUsd(Math.max(1, Number(duration) || 0), resolution, ratio);
  const m = VIDEO_COST_MODEL;
  const raw = Math.max(1, Math.ceil(((usd * m.fxMntPerUsd) / m.creditBasisMnt) * (1 + m.margin)));
  /* дугуй тоо — "416" биш "130" */
  return raw >= 50 ? Math.ceil(raw / 10) * 10 : raw;
}

/**
 * Хүсэлтийн харьцааг тухайн загварын дэмждэг утга руу хөрвүүлнэ.
 *
 * ЭХЛЭХ ЗУРАГТАЙ бол ҮРГЭЛЖ `adaptive` — энэ нь ModelArk-ийн шаардлага,
 * гоо сайхны сонголт БИШ. Баримт: Seedance 2.5-ийн эхний кадрын
 * image-to-video даалгавар "ratio only supports adaptive"; мөн харьцаа
 * зурагтайгаа зөрвөл ModelArk зургийг ТӨВӨӨС нь ТАСАЛЖ хаядаг. Хоёуланг
 * нь `adaptive` шийднэ — загвар зургийн харьцааг хэвээр хадгална.
 *
 * Дэмжихгүй утга ирвэл ЭХНИЙ дэмжигдсэн харьцаанд буулгана — API-аас
 * 400 авахын оронд ажиллах зүйл өгнө.
 */
export function resolveRatio(
  model: VideoModelDef,
  ratioId: string,
  hasImage = false
): { id: VideoRatioId; wire: string } {
  if (hasImage) return { id: "adaptive", wire: "adaptive" };
  const wire = model.ratios[ratioId];
  if (wire) return { id: ratioId as VideoRatioId, wire };
  const [firstId, firstWire] = Object.entries(model.ratios)[0];
  return { id: firstId as VideoRatioId, wire: firstWire };
}

/** Хугацааг загварын зөвшөөрсөн утганд наана (хамгийн ойрхон нь). */
export function resolveDuration(model: VideoModelDef, duration: number): number {
  const d = Number(duration);
  if (model.durations.includes(d)) return d;
  return model.durations.reduce((best, cur) =>
    Math.abs(cur - d) < Math.abs(best - d) ? cur : best, model.durations[0]);
}
