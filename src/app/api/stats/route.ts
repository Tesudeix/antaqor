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

    const [totalUsers, paidMembers, newMembers, newPaid] = await Promise.all([
      User.countDocuments({}),
      // Accurate paid = идэвхтэй subscription-той л (gating-тэй ижил дүрэм).
      User.countDocuments({ clan: { $ne: "" }, subscriptionExpiresAt: { $gte: now } }),
      User.countDocuments({ createdAt: { $gte: dayStart } }),
      User.countDocuments({ clanJoinedAt: { $gte: dayStart } }),
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
