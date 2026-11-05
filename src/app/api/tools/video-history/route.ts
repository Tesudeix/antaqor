import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import { unlink } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/mongodb";
import AiVideo from "@/models/AiVideo";

// GET — миний видеонууд (шинэ нь эхэнд). Зургийн түүхээс НЭГ ЯЛГААТАЙ:
// "processing" мөрүүд ч ирнэ. Учир нь видео минут шаарддаг — хүн хуудсаа
// хааж, дараа буцаж ирэх нь ЖИРИЙН зүйл. Тэр мөрүүд ирснээр хуудас
// тэднийг үргэлжлүүлэн асууж дуусгаж чадна (cron хэрэггүй).
// "failed" нь ирэхгүй — гишүүн алдааг нь харчихсан, кредит нь буцсан.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(60, Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24));
  const before = searchParams.get("before");

  await dbConnect();
  const q: Record<string, unknown> = {
    user: userId,
    status: { $in: ["done", "processing"] },
    deletedAt: { $exists: false },
  };
  if (before && Types.ObjectId.isValid(before)) q._id = { $lt: new Types.ObjectId(before) };

  const [items, stats] = await Promise.all([
    AiVideo.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("prompt modelId ratio duration videoUrl status progress cost createdAt sharedPostId")
      .lean(),
    AiVideo.aggregate([
      { $match: { user: new Types.ObjectId(userId), status: "done" } },
      { $group: { _id: null, count: { $sum: 1 }, credits: { $sum: "$cost" } } },
    ]),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      _id: String(i._id),
      prompt: i.prompt,
      model: i.modelId,
      ratio: i.ratio,
      duration: i.duration,
      url: i.videoUrl,
      status: i.status,
      progress: i.progress,
      cost: i.cost,
      shared: !!i.sharedPostId,
      createdAt: i.createdAt,
    })),
    total: stats[0]?.count || 0,
    creditsSpent: stats[0]?.credits || 0,
    nextBefore: items.length === limit ? String(items[items.length - 1]._id) : null,
  });
}

// DELETE ?id= — МИНИЙ нэг видеог устгах (мөрийг зөөлөн устгаж, файлыг авна).
// Мөр нь үлдэнэ (deletedAt) — админы зардлын тайлан тулж байх ёстой.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  const vid = await AiVideo.findOne({ _id: id, user: userId });
  if (!vid) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (vid.deletedAt) return NextResponse.json({ ok: true });

  // Урсгалд нийтэлсэн бол файлыг ҮЛДЭЭНЭ — пост түүн рүү заасаар байна.
  if (!vid.sharedPostId && vid.videoUrl.startsWith("/uploads/")) {
    const file = path.join(process.cwd(), "public", vid.videoUrl.replace(/^\//, ""));
    await unlink(file).catch(() => {});
  }
  vid.deletedAt = new Date();
  await vid.save();
  return NextResponse.json({ ok: true });
}

// PATCH — видеог "нийтэлсэн" гэж тэмдэглэнэ (хуудас POST /api/posts-ийн дараа дуудна).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const body = (await req.json().catch(() => ({}))) as { id?: string; postId?: string };
  if (!Types.ObjectId.isValid(body.id || "") || !Types.ObjectId.isValid(body.postId || "")) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  await dbConnect();
  await AiVideo.updateOne({ _id: body.id, user: userId }, { $set: { sharedPostId: body.postId } });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
