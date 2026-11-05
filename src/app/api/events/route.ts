import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";
import { expandMany, type RecurringSource } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

/* ─── Нийтийн хуанли ──────────────────────────────────────────────────────

   ӨӨРЧЛӨЛТ (2026-08-24): `recurring` талбар одоо УНШИГДАНА. Өмнө нь энэ
   төгсгөл нь баримт бүрийг НЭГ эвент гэж үзэж, `status`-ыг нь өгөгдлийн
   санд шууд дарж бичдэг байсан. Тэр хоёулаа давтагдах хуваарийг устгадаг:
   "Мягмар бүр 20:00" гэсэн бичлэг эхний Мягмартаа `ended` болоод дахиж
   хэзээ ч гарч ирдэггүй байв.

   Одоо: цуврал бүрийг цонхон дотор дэлгэж, тохиолдол бүрийн төлөвийг
   ЦАГААС нь тооцоолно. Өгөгдлийн санд бичих цорын ганц зүйл нь ДАВТАГДДАГГҮЙ
   эвентийн төлөв — тэдгээрт хадгалагдсан төлөв нь утгатай хэвээр (админ
   гараар цуцалж болно).

   Хариултын бүтэц ХЭВЭЭР: `events[]`, тус бүр `_id`, `date`, `endDate`,
   `status`, `attendeeCount`. `_id` нь ЦУВРАЛЫН id хэвээр үлдэнэ — `/live/[id]`
   ба `/api/events/[id]` түүгээр ажилладаг. Тохиолдол бүрийн ЯЛГААТАЙ түлхүүр
   нь шинэ `occurrenceId` талбар. */

const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  try {
    await dbConnect();

    const now = new Date();

    /* Төлөвийн авто-шинэчлэл — ЗӨВХӨН давтагдахгүй эвент дээр.
       `recurring: { $in: [null, "none"] }` гэж бичсэн шалтгаан: талбар нь
       хожуу нэмэгдсэн тул хуучин баримтууд дээр огт БАЙХГҮЙ, зөвхөн
       `"none"`-ыг шалгавал тэдгээр нь шинэчлэгдэхгүй үлдэнэ. */
    const notRecurring = { recurring: { $in: [null, "none"] } };
    await Event.updateMany(
      { ...notRecurring, status: "upcoming", date: { $lte: now } },
      { $set: { status: "live" } }
    );
    await Event.updateMany(
      { ...notRecurring, status: "live", endDate: { $lte: now } },
      { $set: { status: "ended" } }
    );

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "2026-04"
    const type = searchParams.get("type");
    const status = searchParams.get("status"); // "live" | "upcoming" | "ended"

    /* Цонх. Давтагдах цуврал нь хязгааргүй тул "бүх эвент" гэсэн ойлголт
       байхгүй — үргэлж хугацааны цонх шаардлагатай. */
    let from: Date;
    let to: Date;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 1);
    } else if (status === "ended") {
      from = new Date(now.getTime() - 180 * DAY);
      to = now;
    } else {
      // Өнгөрсөн нэг өдөр нь шөнө дундыг давсан LIVE-ыг барихад хэрэгтэй.
      from = new Date(now.getTime() - DAY);
      to = new Date(now.getTime() + 180 * DAY);
    }

    /* Цувралыг цонхны ӨМНӨ эхэлсэн ч татах ёстой — 3 сарын өмнө эхэлсэн
       "долоо хоног бүр" нь өнөөдөр ч явагдана. Тиймээс огноогоор шүүхгүй,
       зөвхөн цонхны ДАРАА эхэлдэг давтагдахгүй эвентийг хасна. */
    const query: Record<string, unknown> = {
      $or: [
        { recurring: { $nin: [null, "none"] } },
        { date: { $lte: to } },
      ],
    };
    if (type && type !== "all") query.type = type;

    const docs = await Event.find(query)
      .sort({ date: 1 })
      .select(
        "title description type date endDate liveLink liveStreamUrl liveProvider viewerCount location status color attendees image recurring recurringUntil"
      )
      .populate("createdBy", "name avatar")
      .limit(500)
      .lean();

    const rows = expandMany(
      docs,
      (d) => d as unknown as RecurringSource & { _id: unknown },
      { from, to, now, maxPerSeries: month ? 40 : 90 }
    );

    let events = rows.map(({ doc, occ }) => {
      const d = doc as unknown as Record<string, unknown>;
      return {
        ...d,
        date: occ.start,
        endDate: occ.end,
        status: occ.status,
        occurrenceId: occ.occurrenceId,
        seriesId: occ.seriesId,
        occurrenceIndex: occ.index,
        attendeeCount: Array.isArray(d.attendees) ? (d.attendees as unknown[]).length : 0,
      };
    });

    if (status === "live" || status === "upcoming" || status === "ended") {
      events = events.filter((e) => e.status === status);
    } else if (!month) {
      // Параметргүй дуудалт нь өмнө нь `upcoming` + `live`-ыг буцаадаг байсан.
      events = events.filter((e) => e.status !== "ended");
    }

    // Хуанлийн нэг харагдац дээр 300-аас олон мөр гарах шаардлагагүй.
    events = events.slice(0, 300);

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
