import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const GOAL = 140;
// Өдөр бүрийн элсэлтийн суудал — 0-ээс эхэлж тоолно, хуучин гишүүд орохгүй.
const DAILY_SEATS = 20;
// Улаанбаатарын цагаар өдөр солигдоно (UTC+8).
const UB_OFFSET_MS = 8 * 3600 * 1000;
// Тоолол энэ өдрөөс өмнөхийг хэзээ ч оруулахгүй (шинэ кохорт 0-ээс эхэлсэн өдөр).
const COHORT_EPOCH = new Date("2026-07-20T00:00:00+08:00");

function ubDayStart(now: Date): Date {
  const ub = new Date(now.getTime() + UB_OFFSET_MS);
  const start = Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate()) - UB_OFFSET_MS;
  return new Date(Math.max(start, COHORT_EPOCH.getTime()));
}

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const dayStart = ubDayStart(now);

    /* 7 хоногийн цонх нэмэгдэв. `newMembers` нь ӨНӨӨДРИЙН тоо бөгөөд тэр нь
       суудлын тоолуурт зөв ч, нүүрэн дээр үзүүлэх "шинэ гишүүд" гэсэн
       үзүүлэлтэд тохирохгүй: өдрийн эхэнд 0 харагдана. Долоо хоног нь
       тогтвортой, гэхдээ "сүүлийн үед" гэдгийг хэвээр хэлнэ. */
    const weekStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    /* ─── СҮҮДЭР БҮРТГЭЛҮҮД ТООНД ОРОХГҮЙ ────────────────────────────
       Instagram/Messenger DM-ээс автоматаар үүсдэг бүртгэлүүд нь
       `<platform>_<psid>@antaqor.dm` хаягтай бөгөөд хэзээ ч нэвтэрч
       байгаагүй. Тэднийг "гишүүн" гэж тоолох нь зочинд ХУДАЛ тоо
       харуулж байгаа хэрэг — 780 гэж бичээд бодитоор 509 байх нь
       зөвхөн итгэл алдагдуулна. Мөн хөрвүүлэлтийг гуравны нэгээр
       бага харуулж, шийдвэрийг гажуудуулдаг. */
    const REAL = { email: { $not: { $regex: "@antaqor\\.dm$", $options: "i" } } };

    const [totalUsers, paidMembers, newMembers, newPaid, newMembers7d] = await Promise.all([
      User.countDocuments(REAL),
      // Accurate paid = идэвхтэй subscription-той л (gating-тэй ижил дүрэм).
      User.countDocuments({ ...REAL, clan: { $ne: "" }, subscriptionExpiresAt: { $gte: now } }),
      User.countDocuments({ ...REAL, createdAt: { $gte: dayStart } }),
      User.countDocuments({ ...REAL, clanJoinedAt: { $gte: dayStart } }),
      User.countDocuments({ ...REAL, createdAt: { $gte: weekStart } }),
    ]);

    return NextResponse.json(
      {
        totalUsers,
        paidMembers,
        aiConquerors: paidMembers,
        goal: GOAL,
        progress: Math.min((paidMembers / GOAL) * 100, 100),
        // Өнөөдрийн элсэлт — нүүр хуудас зөвхөн эдгээрийг харуулна
        // (хуучин нийт тоог устгаагүй, зүгээр л өнөөдрөөс тоолж байна).
        newMembers,
        newMembers7d,
        newPaid,
        seatsTotal: DAILY_SEATS,
        seatsLeft: Math.max(0, DAILY_SEATS - newPaid),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
