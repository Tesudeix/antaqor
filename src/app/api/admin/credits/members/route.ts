import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";

/* Админ: бүх гишүүдийн кредит зарцуулалт нэг дор.
   GET ?find=текст       → олгохын тулд хүн хайх (нэр / username / утас / имэйл)
   GET ?id=<userId>      → нэг хүний үлдэгдэл, зардлын төрөл, сүүлийн 60 гүйлгээ
   GET ?q=&sort=&page=   → гишүүдийн хүснэгт (үлдэгдэл, зарцуулсан, 30 хоног)  */
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const USER_FIELDS = "name username email phone plan credits creditsLifetime avatar";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const sp = new URL(req.url).searchParams;

  const find = (sp.get("find") || "").trim();
  if (find) {
    const rx = new RegExp(esc(find.slice(0, 60)), "i");
    const users = await User.find({ $or: [{ name: rx }, { username: rx }, { email: rx }, { phone: rx }] })
      .select(USER_FIELDS)
      .limit(8)
      .lean();
    return NextResponse.json({ users });
  }

  const id = sp.get("id");
  if (id && mongoose.isValidObjectId(id)) {
    const oid = new mongoose.Types.ObjectId(id);
    const [user, byReason, tx] = await Promise.all([
      User.findById(oid).select(USER_FIELDS).lean(),
      CreditTx.aggregate([
        { $match: { user: oid } },
        { $group: { _id: { reason: "$reason", kind: "$kind" }, total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      CreditTx.find({ user: oid }).sort({ createdAt: -1 }).limit(60).lean(),
    ]);
    return NextResponse.json({ user, byReason, tx });
  }

  const q = (sp.get("q") || "").trim();
  const sort = sp.get("sort") || "spent30";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const per = 25;
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const sortKey: Record<string, string> = { credits: "credits", spent: "spent", spent30: "spent30", recent: "lastAt", earned: "earned" };

  const pipeline: mongoose.PipelineStage[] = [
    {
      $group: {
        _id: "$user",
        spent: { $sum: { $cond: [{ $eq: ["$kind", "spend"] }, "$amount", 0] } },
        spent30: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "spend"] }, { $gte: ["$createdAt", since30] }] }, "$amount", 0] } },
        earned: { $sum: { $cond: [{ $eq: ["$kind", "earn"] }, "$amount", 0] } },
        lastAt: { $max: "$createdAt" },
        n: { $sum: 1 },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
    { $unwind: "$u" },
    {
      $project: {
        spent: 1, spent30: 1, earned: 1, lastAt: 1, n: 1,
        name: "$u.name", username: "$u.username", email: "$u.email", phone: "$u.phone",
        plan: "$u.plan", credits: { $ifNull: ["$u.credits", 0] }, avatar: "$u.avatar",
      },
    },
  ];
  if (q) {
    const rx = new RegExp(esc(q.slice(0, 60)), "i");
    pipeline.push({ $match: { $or: [{ name: rx }, { username: rx }, { email: rx }, { phone: rx }] } });
  }
  pipeline.push({
    $facet: {
      rows: [{ $sort: { [sortKey[sort] || "spent30"]: -1, lastAt: -1 } }, { $skip: (page - 1) * per }, { $limit: per }],
      meta: [{ $group: { _id: null, total: { $sum: 1 }, spent: { $sum: "$spent" }, spent30: { $sum: "$spent30" }, balance: { $sum: "$credits" } } }],
    },
  });

  const [out] = await CreditTx.aggregate(pipeline);
  const meta = out?.meta?.[0] || { total: 0, spent: 0, spent30: 0, balance: 0 };

  // 30 хоногийн зардал ямар үйлдэлд явсан бэ
  const feature = await CreditTx.aggregate([
    { $match: { kind: "spend", createdAt: { $gte: since30 } } },
    { $group: { _id: "$reason", total: { $sum: "$amount" }, count: { $sum: 1 }, users: { $addToSet: "$user" } } },
    { $project: { total: 1, count: 1, users: { $size: "$users" } } },
    { $sort: { total: -1 } },
    { $limit: 10 },
  ]);

  return NextResponse.json({ rows: out?.rows || [], meta, feature, page, per });
}
