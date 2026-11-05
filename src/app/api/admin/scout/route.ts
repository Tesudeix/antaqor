import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import ScoutQuery from "@/models/ScoutQuery";
import ScoutMemory from "@/models/ScoutMemory";
import Restaurant from "@/models/Restaurant";

export const dynamic = "force-dynamic";

/* ─── /api/admin/scout — агент юу сурч байгааг харуулах ────────────────────
   Хамгийн үнэ цэнтэй мөр нь `resultCount: 0` — хүн асуусан ч сан хариулж
   чадаагүй асуултууд. Тэр жагсаалт нь "дараа юу нэмэх вэ" гэсэн асуултын
   ТААМАГ биш, ХЭМЖИГДСЭН хариулт. Админ тэрхүү нүхийг нөхөх бүрд агент
   бодитоор ухаалаг болно — загвар солих замаар биш.                       */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  await dbConnect();

  const day = 24 * 60 * 60 * 1000;
  const since7 = new Date(Date.now() - 7 * day);
  const since30 = new Date(Date.now() - 30 * day);

  const [total, last7, last30, zeroTotal, users, restaurants, verified] = await Promise.all([
    ScoutQuery.countDocuments({}),
    ScoutQuery.countDocuments({ createdAt: { $gte: since7 } }),
    ScoutQuery.countDocuments({ createdAt: { $gte: since30 } }),
    ScoutQuery.countDocuments({ resultCount: 0, createdAt: { $gte: since30 } }),
    ScoutMemory.countDocuments({}),
    Restaurant.countDocuments({ active: true }),
    Restaurant.countDocuments({ active: true, verified: true }),
  ]);

  const [gaps, recent, districtAgg, toolAgg] = await Promise.all([
    ScoutQuery.find({ resultCount: 0 })
      .sort({ createdAt: -1 })
      .limit(40)
      .select("question createdAt provider")
      .lean(),
    ScoutQuery.find({})
      .sort({ createdAt: -1 })
      .limit(60)
      .populate("user", "name email")
      .select("question reply resultCount createdAt ms provider user")
      .lean(),
    // Хэрэглэгчид ЯМАР дүүрэгт амьдардаг вэ — дараагийн өгөгдөл цуглуулах
    // ажлыг хаанаас эхлэхийг шийднэ.
    ScoutMemory.aggregate([
      { $match: { district: { $nin: ["", null] } } },
      { $group: { _id: "$district", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ]),
    ScoutQuery.aggregate([
      { $match: { createdAt: { $gte: since30 } } },
      { $unwind: "$toolsUsed" },
      { $group: { _id: "$toolsUsed", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
  ]);

  const avgMs = await ScoutQuery.aggregate([
    { $match: { createdAt: { $gte: since7 } } },
    { $group: { _id: null, avg: { $avg: "$ms" } } },
  ]);

  return NextResponse.json({
    kpi: {
      total, last7, last30, zeroTotal, users, restaurants, verified,
      avgMs: Math.round(avgMs[0]?.avg || 0),
      gapRate: last30 > 0 ? Math.round((zeroTotal / last30) * 100) : 0,
    },
    gaps,
    recent,
    districts: districtAgg,
    tools: toolAgg,
  });
}
