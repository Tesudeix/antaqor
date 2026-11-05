/* ─── Давтагдах хуваарийг ЖИНХЭНЭ болгох давхарга ─────────────────────────

   `Event.recurring` талбар анхнаасаа схемд байсан, админ дээр сонгогддог,
   мөн ХАДГАЛАГДДАГ байсан — гэхдээ уншигдаж БАЙГААГҮЙ. Үр дүн нь: "Долоо
   хоног бүрийн Мягмар 20:00 — LIVE хичээл" гэж нэг удаа үүсгэхэд тэр нь
   НЭГ л удаа гарч, дараа нь `status: "ended"` болоод хуанлиас үүрд алга
   болдог. Хуваарь гэдэг нь давтагдах учиртай — тиймээс давтагдахгүй бол
   энэ бол хуваарь биш, зүгээр нэг өнгөрсөн эвентийн жагсаалт.

   Энд шийдэж буй зүйл: нэг бичлэг (цуврал) → цонхон доторх олон тохиолдол.
   Өгөгдлийн санд нэмэлт баримт ҮҮСГЭХГҮЙ. Яагаад вэ: 100 долоо хоногийн
   хичээлийг 100 баримт болгож бичвэл цагийг нь өөрчлөхөд 100 газар засах
   хэрэгтэй болно, мөн аль нь "жинхэнэ" болох нь тодорхойгүй болно. Цуврал
   нь ГАНЦ эх сурвалж хэвээр үлдэж, тохиолдол нь уншигдах үедээ тооцоологдоно.

   ЦАГИЙН БҮС. Монголд зуны цаг байхгүй (2017-оос хойш) тул UTC+8 нь жилийн
   турш тогтмол. Тиймээс "долоо хоног бүр ижил цагт" гэдэг нь UTC дээр яг
   7×24 цаг нэмэхтэй тэнцүү — өдөр/долоо хоногийн алхамд тусгай логик
   хэрэггүй. Сарын алхамд л календарийн арифметик хэрэгтэй бөгөөд түүнийг
   доор UTC+8 хүрээнд хийж, "сарын 15" нь МОНГОЛЫН 15 байхыг баталгаажуулна
   (шууд UTC дээр хийвэл орон нутгийн 00:00–08:00-ын эвентүүд өмнөх өдөрт
   унана).                                                                 */

const MN_OFFSET_MIN = 480; // UTC+8, DST байхгүй
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Хамгийн ихдээ хэдэн тохиолдол буцаах вэ. Хязгааргүй цуврал × урт цонх =
 *  хязгааргүй массив. Энэ тоо нь "нэг жилийн өдөр тутмын" хэмжээнээс арай
 *  дээгүүр — практикт хүрэхгүй, гэхдээ гаралтыг үргэлж хязгаартай байлгана. */
const HARD_CAP = 400;

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface RecurringSource {
  date: string | Date;
  endDate?: string | Date | null;
  recurring?: Recurrence | null;
  recurringUntil?: string | Date | null;
  status?: string;
}

export interface Occurrence {
  /** Цувралын эх баримтын _id. Олон тохиолдол ижил утгатай байна. */
  seriesId: string;
  /** Энэ ЯГ тохиолдлын тогтвортой түлхүүр — React key, дэлгэрэнгүй холбоос. */
  occurrenceId: string;
  start: Date;
  end: Date;
  status: "upcoming" | "live" | "ended";
  /** Цувралын хэд дэх давталт (0 = анхны). */
  index: number;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC+8 хүрээнд сар нэмэх. Тухайн сард уг өдөр байхгүй бол (жишээ нь
 *  1-р сарын 31 → 2-р сар) тэр давталтыг АЛГАСНА — 3-р сарын 3 руу
 *  "гулсуулах" нь хуваарийг чимээгүйхэн худал болгоно. */
function addMonthsMn(base: Date, months: number): Date | null {
  const shifted = new Date(base.getTime() + MN_OFFSET_MIN * 60_000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  const targetMonth = m + months;
  const targetY = y + Math.floor(targetMonth / 12);
  const targetM = ((targetMonth % 12) + 12) % 12;

  // Тухайн сарын хамгийн сүүлийн өдөр.
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  if (d > lastDay) return null;

  const out = Date.UTC(
    targetY,
    targetM,
    d,
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds()
  );
  return new Date(out - MN_OFFSET_MIN * 60_000);
}

function statusFor(start: Date, end: Date, now: Date): Occurrence["status"] {
  const t = now.getTime();
  if (t < start.getTime()) return "upcoming";
  if (t < end.getTime()) return "live";
  return "ended";
}

/**
 * Нэг цувралыг [from, to] цонхон доторх тохиолдлууд болгон дэлгэнэ.
 *
 * Тохиолдол нь цонхтой ДАВХЦВАЛ орно (зөвхөн эхлэл нь цонхонд байх биш) —
 * өчигдөр 23:00-д эхэлж өнөөдөр 01:00-д дуусах LIVE нь "өнөөдөр" гэсэн
 * цонхонд ЗААВАЛ харагдах ёстой, эс бөгөөс явж байгаа дамжуулалт нүүрэн
 * дээрээс алга болно.
 */
export function expandOccurrences(
  ev: RecurringSource,
  opts: { from: Date; to: Date; now?: Date; max?: number }
): Occurrence[] {
  const start0 = toDate(ev.date);
  if (!start0) return [];

  const now = opts.now ?? new Date();
  const max = Math.min(opts.max ?? HARD_CAP, HARD_CAP);
  const seriesId = "";

  const end0 = toDate(ev.endDate ?? null);
  const duration =
    end0 && end0.getTime() > start0.getTime()
      ? end0.getTime() - start0.getTime()
      : DEFAULT_DURATION_MS;

  const mode: Recurrence = (ev.recurring as Recurrence) || "none";
  const until = toDate(ev.recurringUntil ?? null);

  const out: Occurrence[] = [];

  const push = (start: Date, index: number) => {
    const end = new Date(start.getTime() + duration);
    // Цонхтой давхцах эсэх.
    if (end.getTime() < opts.from.getTime()) return;
    if (start.getTime() > opts.to.getTime()) return;
    out.push({
      seriesId,
      occurrenceId: start.toISOString(),
      start,
      end,
      status: statusFor(start, end, now),
      index,
    });
  };

  if (mode === "none") {
    // Давтагдахгүй эвентийн төлөв нь баримт дээрээ хадгалагдсан байж болно
    // (админ гараар "ended" болгосон гэх мэт) — тэр тохиолдолд түүнийг
    // тооцоолсон утгаараа дарж бичихгүй.
    const start = start0;
    const end = new Date(start.getTime() + duration);
    if (end.getTime() < opts.from.getTime() || start.getTime() > opts.to.getTime()) return [];
    const stored = ev.status;
    return [
      {
        seriesId,
        occurrenceId: start.toISOString(),
        start,
        end,
        status:
          stored === "upcoming" || stored === "live" || stored === "ended"
            ? (stored as Occurrence["status"])
            : statusFor(start, end, now),
        index: 0,
      },
    ];
  }

  // Цонхны эхлэлээс ӨМНӨХ давталтуудыг нэг нэгээр нь алхаж үрэхгүйн тулд
  // өдөр/долоо хоногийн алхам дээр шууд тооцож үсэрнэ. Сарын алхам дээр
  // алхах шаардлагатай (сарын урт жигд биш) ч 12 давталт = 1 жил тул хямд.
  const stepMs = mode === "daily" ? DAY_MS : mode === "weekly" ? 7 * DAY_MS : 0;

  if (stepMs > 0) {
    const lower = Math.max(start0.getTime(), opts.from.getTime() - duration);
    const skipped =
      lower > start0.getTime()
        ? Math.floor((lower - start0.getTime()) / stepMs)
        : 0;

    for (let i = skipped; out.length < max; i++) {
      const start = new Date(start0.getTime() + i * stepMs);
      if (start.getTime() > opts.to.getTime()) break;
      if (until && start.getTime() > until.getTime()) break;
      push(start, i);
      // Хамгаалалт: цонх нь маш урт байвал `out.length < max` дээр зогсоно,
      // харин `push` цонхонд оруулаагүй үед ч `start > to` дээр таслагдана.
    }
    return out;
  }

  // monthly
  for (let i = 0; out.length < max && i < 240; i++) {
    const start = addMonthsMn(start0, i);
    if (!start) continue; // тухайн сард уг өдөр байхгүй — алгасав
    if (start.getTime() > opts.to.getTime()) break;
    if (until && start.getTime() > until.getTime()) break;
    push(start, i);
  }
  return out;
}

/**
 * Цуврал бүрийг дэлгээд, нэг эрэмбэлэгдсэн урсгал болгож нийлүүлнэ.
 *
 * `pick` нь эх баримтаас цаг хугацааны талбаруудыг гаргаж авах, `merge` нь
 * тохиолдлыг эх баримт руу буцааж наах үүрэгтэй — ингэснээр энэ функц
 * Mongoose баримт, `.lean()` объект, аль алинтай нь ажиллана.
 */
export function expandMany<T>(
  docs: T[],
  read: (d: T) => RecurringSource & { _id: unknown },
  opts: { from: Date; to: Date; now?: Date; maxPerSeries?: number }
): { doc: T; occ: Occurrence }[] {
  const rows: { doc: T; occ: Occurrence }[] = [];
  for (const d of docs) {
    const src = read(d);
    const id = String(src._id ?? "");
    for (const occ of expandOccurrences(src, {
      from: opts.from,
      to: opts.to,
      now: opts.now,
      max: opts.maxPerSeries ?? 60,
    })) {
      rows.push({
        doc: d,
        occ: { ...occ, seriesId: id, occurrenceId: `${id}:${occ.occurrenceId}` },
      });
    }
  }
  rows.sort((a, b) => a.occ.start.getTime() - b.occ.start.getTime());
  return rows;
}
