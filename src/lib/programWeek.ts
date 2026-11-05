// ─── Нэгдсэн хөтөлбөр (cohort) — «Day N / 7» ───────────────────────────────
// Бүх хүнд НЭГ огнооноос эхэлдэг хөтөлбөр: эхлэх өдөр + үргэлжлэх хоног.
// Гишүүн бүрийн нэгдсэн өдрөөс тоолдог хувийн аялал (lib/program.ts,
// journey_release_hour) өөр зүйл — энэ нь түүнийг хөндөхгүй.
//
// Өдөр нь УЛААНБААТАРЫН огноогоор (UTC+8) солигдоно: хэрэглэгчийн
// төхөөрөмж ямар цагийн бүсэд байхаас үл хамааран бүгд ижил «Day»-г харна.
// Client-safe — DB импорт байхгүй.

export interface ProgramWeek {
  active: boolean;
  title: string;
  /** YYYY-MM-DD, УБ огноо. */
  start: string;
  days: number;
  /** Өдөр бүрийн сэдэв (заавал биш). items[0] = Day 1. */
  items: string[];
}

export const PROGRAM_WEEK_KEY = "program_week";

export const PROGRAM_WEEK_DEFAULT: ProgramWeek = {
  active: true,
  title: "7 хоногийн хөтөлбөр",
  start: "2026-10-26",
  days: 7,
  items: [],
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeProgramWeek(raw: unknown): ProgramWeek {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ProgramWeek>;
  const days = Math.min(30, Math.max(1, Math.round(Number(r.days) || PROGRAM_WEEK_DEFAULT.days)));
  const start = typeof r.start === "string" && DATE_RE.test(r.start) ? r.start : PROGRAM_WEEK_DEFAULT.start;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 80) : PROGRAM_WEEK_DEFAULT.title;
  const items = Array.isArray(r.items)
    ? r.items.slice(0, days).map((s) => (typeof s === "string" ? s.trim().slice(0, 80) : ""))
    : [];
  return { active: r.active !== false, title, start, days, items };
}

/** УБ огноо (YYYY-MM-DD) — тухайн мөчид. */
export function ubDate(ms: number = Date.now()): string {
  return new Date(ms + 8 * 3600_000).toISOString().slice(0, 10);
}

function dayNumber(ymd: string): number {
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86400_000);
}

export interface ProgramDayInfo {
  state: "before" | "live" | "done";
  /** live үед 1..days, бусад үед 0. */
  day: number;
  /** before үед эхлэхэд үлдсэн өдөр. */
  startsIn: number;
  /** Өдөр бүрийн «MM.DD» шошго. */
  dates: string[];
}

export function programDay(p: ProgramWeek, now: number = Date.now()): ProgramDayInfo {
  const diff = dayNumber(ubDate(now)) - dayNumber(p.start);
  const base = Date.parse(`${p.start}T00:00:00Z`);
  const dates = Array.from({ length: p.days }, (_, i) => {
    const d = new Date(base + i * 86400_000);
    return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
  });
  if (diff < 0) return { state: "before", day: 0, startsIn: -diff, dates };
  if (diff >= p.days) return { state: "done", day: 0, startsIn: 0, dates };
  return { state: "live", day: diff + 1, startsIn: 0, dates };
}
