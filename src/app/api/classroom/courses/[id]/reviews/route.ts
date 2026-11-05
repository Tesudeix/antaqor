import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { isAdmin } from "@/lib/admin";
import { hasPlanAccess, type PlanId } from "@/lib/plans";
import Course from "@/models/Course";
import CourseReview from "@/models/CourseReview";
import User from "@/models/User";

type Context = { params: Promise<{ id: string }> };
async function access(id: string) {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;
  if (!uid) return { error: NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 }) };
  if (!mongoose.isValidObjectId(id)) return { error: NextResponse.json({ error: "Курс олдсонгүй" }, { status: 404 }) };
  await dbConnect();
  const [course, user] = await Promise.all([Course.findById(id).lean(), User.findById(uid).select("plan subscriptionExpiresAt role").lean()]);
  if (!course) return { error: NextResponse.json({ error: "Курс олдсонгүй" }, { status: 404 }) };
  const admin = isAdmin(session?.user?.email) || user?.role === "admin";
  const plan: PlanId = admin ? "operator" : user?.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date() ? (user.plan || "starter") as PlanId : "free";
  const required = course.requiredPlan === "free" ? "starter" : course.requiredPlan || "starter";
  if (!hasPlanAccess(plan, required)) return { error: NextResponse.json({ error: "Энэ курсын эрх шаардлагатай" }, { status: 403 }) };
  return { uid };
}
export async function GET(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const auth = await access(id);
  if (auth.error) return auth.error;
  const page = Math.max(1, Math.min(10000, Number(req.nextUrl.searchParams.get("page")) || 1));
  const [reviews, stats, mine] = await Promise.all([
    CourseReview.find({ course: id }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 10).limit(10).populate("user", "name").lean(),
    CourseReview.aggregate([{ $match: { course: new mongoose.Types.ObjectId(id) } }, { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } }]),
    CourseReview.findOne({ course: id, user: auth.uid }).select("rating comment").lean(),
  ]);
  return NextResponse.json({ reviews: reviews.map(r => ({ _id: r._id, name: r.user?.name || "Суралцагч", rating: r.rating, comment: r.comment, createdAt: r.createdAt })), average: stats[0]?.average || 0, count: stats[0]?.count || 0, mine });
}
export async function PUT(req: NextRequest, ctx: Context) {
  const { id } = await ctx.params;
  const auth = await access(id);
  if (auth.error) return auth.error;
  const body = await req.json().catch(() => null);
  if (!body || !Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.comment !== "string" || body.comment.length > 2000) {
    return NextResponse.json({ error: "1–5 од сонгоно уу. Сэтгэгдэл 2000 тэмдэгтээс хэтрэхгүй." }, { status: 400 });
  }
  await CourseReview.updateOne({ course: id, user: auth.uid }, { $set: { rating: body.rating, comment: body.comment.trim() } }, { upsert: true, runValidators: true });
  return NextResponse.json({ ok: true });
}
