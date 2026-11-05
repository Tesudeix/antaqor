import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Program from "@/models/Program";

/* GET /api/programs — нийтийн жагсаалт. Нэвтрэх шаардлагагүй: хөтөлбөр
   бол маркетинг, нууц биш. Зочны нүүр ба бүртгэлийн алхам хоёулаа
   ЭНЭ маршрутаас уншина. */
export async function GET() {
  await dbConnect();
  const rows = await Program.find({ enabled: true }).sort({ order: 1 }).lean();
  return NextResponse.json({
    programs: rows.map((p) => ({
      slug: p.slug,
      code: p.code,
      title: p.title,
      kicker: p.kicker,
      audience: p.audience,
      scheduleDays: p.scheduleDays,
      scheduleTime: p.scheduleTime,
      summary: p.summary,
      lessonCount: p.lessonCount,
      stats: p.stats,
      takeaway: p.takeaway,
      bullets: p.bullets,
      accent: p.accent,
    })),
  });
}

export const dynamic = "force-dynamic";
