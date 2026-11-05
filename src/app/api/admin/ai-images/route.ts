import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import AiImage from "@/models/AiImage";
import Payment from "@/models/Payment";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";
import { loadImagePricing, saveImagePricing, type PricingPatch } from "@/lib/imagePricingServer";
import { IMAGE_MODELS, USD_RATES } from "@/lib/imagePricing";
import { CREDIT_PACKAGES as CREDIT_PACKAGES_HINT } from "@/lib/creditPackages";

// ─── /admin/ai-images data ──────────────────────────────────────────────────
// GET  → KPIs (generations, credits, USD cost, ₮ revenue), pending top-ups,
//        per-user spend, per-model breakdown, recent generations, settings.
// PATCH→ settings (credit prices, HD multiplier, like→credit ratio).

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") || "30", 10) || 30));
  const since = daysAgo(days);
  const today = startOfToday();

  await dbConnect();

  const sumStage = {
    $group: {
      _id: null,
      count: { $sum: 1 },
      done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
      failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
      credits: { $sum: { $cond: [{ $eq: ["$status", "done"] }, "$cost", 0] } },
      usd: { $sum: "$usd" },
      usdEstimated: { $sum: { $cond: ["$usdEstimate", "$usd", 0] } },
      avgMs: { $avg: { $cond: [{ $eq: ["$status", "done"] }, "$durationMs", null] } },
    },
  };

  const [
    windowAgg, todayAgg, allAgg,
    byModel, byUser, recent,
    pendingTopups, revenueAgg, creditsAgg,
    likeCreditsAgg, pricing, rateAgg,
  ] = await Promise.all([
    AiImage.aggregate([{ $match: { createdAt: { $gte: since } } }, sumStage]),
    AiImage.aggregate([{ $match: { createdAt: { $gte: today } } }, sumStage]),
    AiImage.aggregate([sumStage]),
    AiImage.aggregate([
      { $match: { createdAt: { $gte: since }, status: "done" } },
      { $group: { _id: { model: "$modelId", version: "$modelVersion" }, count: { $sum: 1 }, credits: { $sum: "$cost" }, usd: { $sum: "$usd" }, avgMs: { $avg: "$durationMs" } } },
      { $sort: { count: -1 } },
    ]),
    AiImage.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$user", count: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }, credits: { $sum: { $cond: [{ $eq: ["$status", "done"] }, "$cost", 0] } }, usd: { $sum: "$usd" }, last: { $max: "$createdAt" } } },
      { $sort: { credits: -1, count: -1 } },
      { $limit: 25 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 1, count: 1, done: 1, credits: 1, usd: 1, last: 1, name: "$u.name", email: "$u.email", avatar: "$u.avatar", balance: "$u.credits", phone: "$u.phone" } },
    ]),
    AiImage.find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(36)
      .populate("user", "name email avatar")
      .select("user prompt modelId modelVersion aspectRatio resolution url cost usd usdEstimate status error durationMs createdAt tokens refCount")
      .lean(),
    Payment.find({ kind: "credits", status: "pending" })
      .sort({ receiptUploadedAt: -1, createdAt: -1 })
      .limit(50)
      .populate("user", "name email avatar phone credits")
      .select("user amount creditAmount packageId referenceCode receiptImage receiptUploadedAt claimedAt createdAt")
      .lean(),
    Payment.aggregate([
      { $match: { kind: "credits", status: "paid", paidAt: { $gte: since } } },
      { $group: { _id: null, amount: { $sum: "$amount" }, credits: { $sum: "$creditAmount" }, count: { $sum: 1 } } },
    ]),
    User.aggregate([{ $group: { _id: null, circulating: { $sum: "$credits" }, holders: { $sum: { $cond: [{ $gt: ["$credits", 0] }, 1, 0] } } } }]),
    CreditTx.aggregate([
      { $match: { reason: "LIKE_RECEIVED", kind: "earn", createdAt: { $gte: since } } },
      { $group: { _id: null, credits: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    loadImagePricing(),
    /* Бодит ₮/кредит — бүх цагийн төлөгдсөн цэнэглэлтээс. */
    Payment.aggregate([
      { $match: { kind: "credits", status: "paid", creditAmount: { $gt: 0 } } },
      { $group: { _id: null, mnt: { $sum: "$amount" }, credits: { $sum: "$creditAmount" } } },
    ]),
  ]);

  const z = { count: 0, done: 0, failed: 0, credits: 0, usd: 0, usdEstimated: 0, avgMs: 0 };
  const win = windowAgg[0] || z;
  const rev = revenueAgg[0] || { amount: 0, credits: 0, count: 0 };

  /* ₮ per credit: measured from real paid top-ups, floored at the
     cheapest tier (50₮) so a single discounted sale cannot make the
     margin look better than it is. */
  const soldMnt = rateAgg[0]?.mnt || 0;
  const soldCredits = rateAgg[0]?.credits || 0;
  const measuredRate = soldCredits > 0 ? soldMnt / soldCredits : 0;
  const MNT_PER_CREDIT_FLOOR = measuredRate > 0 ? Math.min(50, Math.round(measuredRate)) : 50;
  const USD_MNT = Number(process.env.USD_MNT_RATE || 3450);

  return NextResponse.json({
    days,
    kpis: {
      window: win,
      today: todayAgg[0] || z,
      all: allAgg[0] || z,
      revenue: rev,                                  // paid credit top-ups in window
      burnedMnt: win.credits * MNT_PER_CREDIT_FLOOR, // credits spent × floor price
      costMnt: Math.round(win.usd * USD_MNT),
      usdMntRate: USD_MNT,
      mntPerCredit: MNT_PER_CREDIT_FLOOR,
      measuredRate: Math.round(measuredRate),
      soldMnt, soldCredits,
      circulating: creditsAgg[0]?.circulating || 0,
      holders: creditsAgg[0]?.holders || 0,
      likeCredits: likeCreditsAgg[0] || { credits: 0, count: 0 },
    },
    byModel,
    byUser,
    recent,
    pendingTopups,
    pricing,
    catalog: IMAGE_MODELS,
    usdRates: USD_RATES,
    packagesHint: CREDIT_PACKAGES_HINT,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as PricingPatch;
  const pricing = await saveImagePricing(body);
  return NextResponse.json({ ok: true, pricing });
}

export const dynamic = "force-dynamic";
