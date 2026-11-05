import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

/* GET /api/reels/can-upload — тэжээл дээр «+» товчийг үзүүлэх эсэх.
   Энэ нь ЗӨВХӨН дэлгэцийн чимэг; жинхэнэ шалгалт нь upload маршрут
   дээр дахин хийгддэг (клиент талын хариуг хэзээ ч итгэж болохгүй). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ allowed: false });
  if (isAdmin(session.user.email)) return NextResponse.json({ allowed: true });
  await dbConnect();
  const u = await User.findOne({ email: session.user.email }).select("canUploadReels").lean();
  return NextResponse.json({ allowed: !!(u as { canUploadReels?: boolean } | null)?.canUploadReels });
}

export const dynamic = "force-dynamic";
