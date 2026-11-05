/* ─── Контент агент: сервер + клиент хоёуланд ажилладаг цэвэр функцууд ────
   Цаг (УБ = UTC+8, зун/өвлийн цаг байхгүй), 7 хоногийн хил, ноорог шалгах
   дүрмүүд. Шалгалт нь ЗАСАХГҮЙ, ЗААНА — хүн ноорог харж байгаа тул нүдийг
   нь зөв газар аваачихад хангалттай (threadsVoice.voiceWarnings-тай ижил зарчим). */

export const UB_OFFSET = 8 * 3600e3;
export const DAY = 864e5;
export const WEEKDAYS = ["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"];
export const WD_SHORT = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
export const PLATFORM_LIMIT: Record<string, number> = { threads: 500, instagram: 2200, facebook: 63206 };
export const PLATFORM_NAME: Record<string, string> = { threads: "Threads", facebook: "Facebook", instagram: "Instagram" };

/** УБ-ын цагаар задлах. wd: 0 = Даваа … 6 = Ням */
export function ub(d: Date | string | number) {
  const u = new Date(new Date(d).getTime() + UB_OFFSET);
  return { y: u.getUTCFullYear(), mo: u.getUTCMonth() + 1, d: u.getUTCDate(), h: u.getUTCHours(), mi: u.getUTCMinutes(), wd: (u.getUTCDay() + 6) % 7 };
}
/** УБ-ын тухайн өдрийн 00:00 (UTC Date) */
export function ubDayStart(d: Date | string | number): Date {
  const p = ub(d);
  return new Date(Date.UTC(p.y, p.mo - 1, p.d) - UB_OFFSET);
}
/** УБ-ын Даваа 00:00 */
export function weekStartOf(d: Date | string | number): Date {
  const start = ubDayStart(d);
  return new Date(start.getTime() - ub(d).wd * DAY);
}
export function ubAt(day: Date, hour: number, minute = 0): Date {
  return new Date(ubDayStart(day).getTime() + hour * 3600e3 + minute * 60e3);
}
export function isoWeek(weekStart: Date | string): number {
  const p = ub(new Date(new Date(weekStart).getTime() + 3 * DAY)); // Пүрэв нь ISO 7 хоногийг тодорхойлно
  const thursday = Date.UTC(p.y, p.mo - 1, p.d);
  const jan1 = Date.UTC(p.y, 0, 1);
  return Math.floor((thursday - jan1) / DAY / 7) + 1;
}
const pad = (n: number) => String(n).padStart(2, "0");
export const hm = (d: Date | string) => { const p = ub(d); return `${pad(p.h)}:${pad(p.mi)}`; };
export const md = (d: Date | string) => { const p = ub(d); return `${pad(p.mo)}/${pad(p.d)}`; };
export const ymd = (d: Date | string) => { const p = ub(d); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; };
/** <input type="datetime-local">-ийн утга (УБ) ↔ Date */
export const toLocalInput = (d: Date | string) => `${ymd(d)}T${hm(d)}`;
export function fromLocalInput(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - UB_OFFSET);
}
export function weekLabel(weekStart: Date | string) {
  const s = new Date(weekStart), e = new Date(s.getTime() + 6 * DAY);
  return `${md(s)} – ${md(e)}`;
}
/** Дараагийн автомат ажиллах мөч (runWeekday 1 = Даваа) */
export function nextRun(runWeekday: number, runHour: number, now = new Date()): Date {
  const ws = weekStartOf(now);
  let t = new Date(ws.getTime() + (runWeekday - 1) * DAY + runHour * 3600e3);
  if (t.getTime() <= now.getTime()) t = new Date(t.getTime() + 7 * DAY);
  return t;
}

/* ─── Ноорог шалгах дүрэм ─────────────────────────────────────────────── */
export type Check = { level: "error" | "warn"; code: string; label: string };
export type CheckBrand = { kind: "personal" | "product"; product?: { facts?: string[]; banned?: string[]; description?: string; price?: string; offer?: string; usps?: string[] } };
export type CheckSlot = { caption: string; platforms: string[]; format: string; imageUrl: string; imageState?: string; at: Date | string };

const words = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2));
export function similarity(a: string, b: string): number {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach((w) => { if (B.has(w)) inter++; });
  return inter / (A.size + B.size - inter);
}

export function checkSlot(slot: CheckSlot, brand: CheckBrand, opts: { recent?: string[]; now?: number } = {}): Check[] {
  const out: Check[] = [];
  const t = (slot.caption || "").trim();
  const len = Array.from(t).length;
  if (!t) out.push({ level: "error", code: "empty", label: "Текст хоосон" });
  for (const p of slot.platforms) {
    const lim = PLATFORM_LIMIT[p];
    if (lim && len > lim) out.push({ level: "error", code: `len-${p}`, label: `${PLATFORM_NAME[p]}: ${len}/${lim} тэмдэгт — хэтэрсэн` });
  }
  if (!slot.platforms.length) out.push({ level: "error", code: "no-platform", label: "Суваг сонгоогүй" });
  if (slot.platforms.includes("instagram") && !slot.imageUrl) out.push({ level: "error", code: "ig-image", label: "Instagram-д зураг заавал хэрэгтэй" });
  const at = new Date(slot.at).getTime();
  if (at < (opts.now ?? Date.now()) + 60e3) out.push({ level: "error", code: "past", label: "Товлох цаг өнгөрсөн — цагаа өөрчилнө үү" });

  if (brand.kind === "personal") {
    if (/(?<!\p{L})(та|таны|танд|таныг|тань|тантай)(?!\p{L})/iu.test(t)) out.push({ level: "warn", code: "formal", label: "«Та» хэлбэр — энэ брэнд «чи» гэдэг" });
    if (/(^|\s)#[\p{L}\p{N}_]+/u.test(t)) out.push({ level: "warn", code: "hashtag", label: "Hashtag — энэ брэнд хэрэглэдэггүй" });
    /* Дуу хоолойн дүрэм «түүхэнд тоо заавал» гэдэг тул AI тоо зохиох эрсдэлтэй — хүн нүдээр баталгаажуулна */
    const nums = Array.from(new Set(t.match(/\d+(?:[.,:/]\d+)?/g) || [])).slice(0, 5);
    if (nums.length) out.push({ level: "warn", code: "numbers", label: `Тоо орсон (${nums.join(", ")}) — бодит эсэхийг шалгана уу` });
  } else {
    /* Брифэд байхгүй тоо = зохиомол байх магадлалтай (үнэ, хувь, хугацаа) */
    const p = brand.product || {};
    const known = [p.description, p.price, p.offer, ...(p.facts || []), ...(p.usps || [])].join(" ");
    const nums = (t.match(/\d[\d.,%]*/g) || []).map((n) => n.replace(/[.,%]+$/, "")).filter((n) => n.length > 0 && !known.includes(n));
    if (nums.length) out.push({ level: "warn", code: "unknown-number", label: `Брифэд байхгүй тоо: ${Array.from(new Set(nums)).slice(0, 4).join(", ")} — үнэн эсэхийг шалгана уу` });
    const banned = (p.banned || []).filter((b) => b.trim() && t.toLowerCase().includes(b.trim().toLowerCase()));
    if (banned.length) out.push({ level: "error", code: "banned", label: `Хориотой үг/амлалт: ${banned.slice(0, 3).join(", ")}` });
  }
  const longLine = t.split("\n").find((l) => Array.from(l.trim()).length > 140);
  if (longLine) out.push({ level: "warn", code: "long-line", label: "Хэт урт мөр — уншихад хүнд" });
  const recent = opts.recent || [];
  const sim = recent.reduce((m, r) => Math.max(m, similarity(t, r)), 0);
  if (sim >= 0.45) out.push({ level: "warn", code: "similar", label: `Өмнөх посттой ${Math.round(sim * 100)}% төстэй — давхардал гэж тооцогдож магадгүй` });
  if (slot.format === "image" && !slot.imageUrl && slot.imageState !== "queued" && slot.imageState !== "working") out.push({ level: "warn", code: "no-image", label: "Зурагтай пост гэж төлөвлөсөн ч зураг алга" });
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Дараалалд", writing: "Бичиж байна", draft: "Батлахыг хүлээж буй", scheduled: "Товлогдсон",
  publishing: "Нийтэлж байна", published: "Нийтлэгдсэн", failed: "Алдаа", skipped: "Алгассан", error: "Бичиж чадсангүй",
};
/** Pillar-ийн өнгө — нэрээс тогтвортой (брэнд бүрт ижил pillar ижил өнгөтэй) */
export const PILLAR_COLORS = ["#2E29FF", "#0E9F6E", "#D97706", "#7C3AED", "#DB2777", "#0891B2", "#65A30D", "#DC2626"];
export function pillarColor(name: string, all: string[]): string {
  const i = all.indexOf(name);
  if (i >= 0) return PILLAR_COLORS[i % PILLAR_COLORS.length];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PILLAR_COLORS[h % PILLAR_COLORS.length];
}
