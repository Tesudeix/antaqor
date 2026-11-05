import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/* POST /api/users/[id]/follow — дагах / болих (toggle). 2026-10-11.
   Дагагчийн жагсаалт нь ДАГАЖ БУЙ хүний `following[]` дээр хадгалагдана;
   "дагагч" тоо = энэ id-г following-тоо агуулсан хэрэглэгчийн тоо
   (индекстэй). Тусдаа Follow коллекц хийх шаардлагагүй — хэмжээ бага. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const me = (session?.user as { id?: string } | undefined)?.id;
  if (!me) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Буруу id" }, { status: 400 });
  if (id === me) return NextResponse.json({ error: "Өөрийгөө дагах боломжгүй" }, { status: 400 });
  const rl = rateLimit(`follow:${me}`, { max: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Дэндүү олон. Түр хүлээнэ үү." }, { status: 429 });

  await dbConnect();
  const target = await User.exists({ _id: id });
  if (!target) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

  const oid = new mongoose.Types.ObjectId(id);
  const already = await User.exists({ _id: me, following: oid });
  await User.updateOne({ _id: me }, already ? { $pull: { following: oid } } : { $addToSet: { following: oid } });
  const followersCount = await User.countDocuments({ following: oid });
  return NextResponse.json({ following: !already, followersCount });
}
