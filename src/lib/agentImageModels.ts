/* ─── Antaqor Agent · «AI зураг» хэсгийн загварууд (2026-10-24) ─────────────
   Клиент + сервер хоёуланд (сервер import алга). Higgsfield-ийн Image хуудсаас санаа авсан:
   доод талын нэг мөр промпт + загвар/харьцаа/чанар/хэмжээ/тоо, дээр нь бүтээлүүд.

   Хаана ажилладаг вэ (2026-10-24-нд API-аас шалгасан):
     · Google шууд (lib/nanoBanana): Nano Banana 2.1, Nano Banana Pro — Higgsfield API дээр
       `nano-banana-pro` «model_disabled» (503) тул сайтын Gemini түлхүүрээр.
     · Higgsfield: GPT Image 2 = marketing-studio/image (2.0 Alpha), GPT Image 2.5 = …/flare,
       Grok Imagine 2.0, Soul 2, Recraft 4.1, Z-Image Turbo.
   Үнэ ($/зураг) = суурь[хэмжээ] × чанарын коэфф. Higgsfield: 1k low $0.0138, 2k low $0.0189,
   4k high $0.6136 (GPT 2); Flare low/medium/high ≈ .011/.045/.17 (2026-10-24 хэмжсэн). Nano 2.1 ≈ $0.068
   (сайтын бодит дундаж). Бусад нь нийтэлсэн үнэ — бодит өртөг AgentMedia.usd-д. */

export type ImgProvider = "google" | "hf";
export type ImgQual = { id: string; label: string; hint: string };
export type ImgModel = {
  id: string; label: string; by: string; provider: ImgProvider;
  /** Нэг өгүүлбэр — юунд хамгийн сайн (энгийн Монгол хэлээр) */
  note: string; tags: string[];
  /** Лавлах зургийн дээд тоо (0 = зөвхөн бичвэрээс) */
  refs: number;
  ratios: string[]; res: string[]; quals: ImgQual[];
  base: Record<string, number>; qmul?: Record<string, number>;
};

const Q3: ImgQual[] = [
  { id: "low", label: "Хурдан", hint: "Санаа турших" },
  { id: "medium", label: "Сайн", hint: "Ихэнх постод" },
  { id: "high", label: "Дээд", hint: "Хэвлэл, сурталчилгаа" },
];
const GPT_RATIOS = ["auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"];
const NANO_RATIOS = ["auto", "1:1", "4:5", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"];
const GPT_Q = { low: 1, medium: 4.1, high: 15.5 };

export const AUTO = "auto";
export const IMG_MODELS: ImgModel[] = [
  { id: "nano21", label: "Nano Banana 2.1", by: "Google", provider: "google", note: "Бодит зураг. Таны оруулсан зураг, дүрийг хамгийн үнэнч дагана.", tags: ["Бодит", "Лавлах зураг"], refs: 10, ratios: NANO_RATIOS, res: ["1k", "2k"], quals: [], base: { "1k": 0.068, "2k": 0.1 } },
  { id: "nanoPro", label: "Nano Banana Pro", by: "Google", provider: "google", note: "Хамгийн нарийн, бичиг ба инфографик сайн. Удаан, үнэтэй.", tags: ["Дээд чанар", "Бичиг"], refs: 10, ratios: NANO_RATIOS, res: ["1k", "2k"], quals: [], base: { "1k": 0.134, "2k": 0.134 } },
  { id: "gpt2", label: "GPT Image 2", by: "OpenAI · ChatGPT", provider: "hf", note: "ChatGPT-ийн зураг. Санааг яг ойлгоно, постер, бичигтэй дизайн.", tags: ["Бичиг", "Постер", "4K"], refs: 10, ratios: GPT_RATIOS, res: ["1k", "2k", "4k"], quals: Q3, base: { "1k": 0.0138, "2k": 0.0189, "4k": 0.04 }, qmul: GPT_Q },
  { id: "gpt25", label: "GPT Image 2.5", by: "OpenAI · шинэ", provider: "hf", note: "OpenAI-ийн хамгийн шинэ. Зураг засах, бүтээгдэхүүнийг алдаагүй хадгална.", tags: ["Засвар", "Бүтээгдэхүүн", "4K"], refs: 10, ratios: GPT_RATIOS, res: ["1k", "2k", "4k"], quals: Q3, base: { "1k": 0.0107, "2k": 0.0147, "4k": 0.04 }, qmul: GPT_Q },
  { id: "grok2", label: "Grok Imagine 2.0", by: "xAI", provider: "hf", note: "Тод, хүчтэй өнгө. Сошиалд анхаарал татах уран сайхны зураг.", tags: ["Уран сайхан"], refs: 10, ratios: ["auto", "1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "1:2", "2:1"], res: ["1k", "2k"], quals: [{ id: "low", label: "Хурдан", hint: "" }, { id: "medium", label: "Сайн", hint: "" }], base: { "1k": 0.04, "2k": 0.06 }, qmul: { low: 1, medium: 1.33 } },
  { id: "soul2", label: "Soul 2", by: "Higgsfield", provider: "hf", note: "Бодит хүн, загвар, lifestyle. Хамгийн хямд.", tags: ["Хүн", "Хямд"], refs: 0, ratios: ["1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"], res: ["1080p", "720p"], quals: [], base: { "720p": 0.003, "1080p": 0.006 } },
  { id: "recraft", label: "Recraft 4.1", by: "Recraft", provider: "hf", note: "Лого, иллюстраци, брэндийн график, цэвэр дизайн.", tags: ["Лого", "График"], refs: 0, ratios: ["1:1", "4:5", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9"], res: ["1k"], quals: [], base: { "1k": 0.035 } },
  { id: "zimage", label: "Z-Image Turbo", by: "Tongyi", provider: "hf", note: "Хамгийн хурдан. Санаагаа хямдаар турших.", tags: ["Хурдан", "Хямд"], refs: 0, ratios: ["1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"], res: ["1k", "2k"], quals: [], base: { "1k": 0.015, "2k": 0.015 } },
];
export const imgModel = (id: string) => IMG_MODELS.find((m) => m.id === id);

/** Харьцааны шошго — хэрэглэгч хэмжээгээр биш «хаана ашиглах»-аар сонгоно */
export const RATIO_USE: Record<string, string> = {
  auto: "Авто", "1:1": "Пост", "4:5": "Instagram", "3:4": "Хөрөг", "4:3": "Слайд", "2:3": "Постер", "3:2": "Фото",
  "9:16": "Story · Reel", "16:9": "YouTube · Cover", "21:9": "Баннер", "1:2": "Өндөр", "2:1": "Өргөн",
};

export function imgCost(id: string, res: string, q: string): number {
  const m = imgModel(id);
  if (!m) return 0;
  const b = m.base[res] ?? Object.values(m.base)[0] ?? 0;
  return Math.round(b * (m.qmul?.[q] ?? 1) * 10000) / 10000;
}
/** Сонголтыг тухайн загварт байгаа утга руу шахна */
export function imgNorm(m: ImgModel, o: { ratio?: string; res?: string; q?: string }) {
  const ratio = m.ratios.includes(o.ratio || "") ? o.ratio! : m.ratios.includes("1:1") ? "1:1" : m.ratios[0];
  const res = m.res.includes(o.res || "") ? o.res! : m.res[0];
  const q = m.quals.some((x) => x.id === o.q) ? o.q! : m.quals.find((x) => x.id === "medium")?.id || m.quals[0]?.id || "";
  return { ratio, res, q };
}

/** «Автомат» — бичсэн санаа, лавлах зургаас загвар сонгоно (хэрэглэгч загвар мэдэх шаардлагагүй) */
export function autoPick(prompt: string, refs: number, google: boolean): { id: string; why: string } {
  const text = /["“”«»]|постер|poster|лого|logo|бичиг|бичээс|гарчиг|текст|text|инфограф|infograph|баннер|banner|menu|цэс/i.test(prompt);
  if (refs > 0) return google ? { id: "nano21", why: "Таны зургийг үнэнч дагана" } : { id: "gpt25", why: "Таны зургийг үнэнч дагана" };
  if (text) return { id: "gpt2", why: "Бичигтэй дизайнд хамгийн сайн" };
  return google ? { id: "nano21", why: "Бодит, тод зураг" } : { id: "gpt2", why: "Санааг яг ойлгоно" };
}
