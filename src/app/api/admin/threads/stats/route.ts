import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsAutoReplyLog from "@/models/ThreadsAutoReplyLog";
import ThreadsTrigger from "@/models/ThreadsTrigger";
import ThreadsLead from "@/models/ThreadsLead";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [triggersToday, sentToday, errorsToday, sentWeek, sentHour, leadsToday, activeAutomations, topPostAgg] =
    await Promise.all([
      ThreadsAutoReplyLog.countDocuments({ status: { $in: ["sent", "error"] }, createdAt: { $gt: dayAgo } }),
      ThreadsAutoReplyLog.countDocuments({ status: "sent", createdAt: { $gt: dayAgo } }),
      ThreadsAutoReplyLog.countDocuments({ status: "error", createdAt: { $gt: dayAgo } }),
      ThreadsAutoReplyLog.countDocuments({ status: "sent", createdAt: { $gt: weekAgo } }),
      ThreadsAutoReplyLog.countDocuments({ status: "sent", createdAt: { $gt: hourAgo } }),
      ThreadsLead.countDocuments({ createdAt: { $gt: dayAgo } }),
      ThreadsTrigger.countDocuments({ enabled: true }),
      ThreadsAutoReplyLog.aggregate([
        { $match: { status: "sent", createdAt: { $gt: weekAgo }, postId: { $ne: "" } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

  // Per-automation hits for the dashboard leaderboard.
  const topAutomations = await ThreadsTrigger.find({ hitCount: { $gt: 0 } })
    .select("name hitCount lastFiredAt enabled triggerType")
    .sort({ hitCount: -1 })
    .limit(5)
    .lean();

  return NextResponse.json({
    triggersToday, sentToday, errorsToday, sentWeek, sentHour, leadsToday, activeAutomations,
    topPost: topPostAgg[0] ? { postId: topPostAgg[0]._id, count: topPostAgg[0].count } : null,
    topAutomations,
  });
}
