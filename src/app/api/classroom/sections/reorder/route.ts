import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Section from "@/models/Section";

// POST { course, ids: [sectionId…] } — бүлгийн дарааллыг массивын дарааллаар
// 1,2,3… болгож бичнэ. Зөвхөн тухайн курсийн бүлгүүд хүлээн авна.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { course, ids } = await req.json();
  if (!mongoose.isValidObjectId(course) || !Array.isArray(ids) || ids.some((i) => !mongoose.isValidObjectId(i))) {
    return NextResponse.json({ error: "course + ids шаардлагатай" }, { status: 400 });
  }
  await dbConnect();
  const owned = await Section.countDocuments({ course, _id: { $in: ids } });
  if (owned !== ids.length) return NextResponse.json({ error: "Бүлэг энэ курст хамаарахгүй" }, { status: 400 });
  await Section.bulkWrite(
    ids.map((id: string, i: number) => ({ updateOne: { filter: { _id: id, course }, update: { $set: { order: i + 1 } } } }))
  );
  return NextResponse.json({ success: true });
}
