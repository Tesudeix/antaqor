// Scheduled-post runner.
//
// Publishes SocialPost rows whose scheduledAt has come due. Runs every 5
// minutes from crontab, so "post at 15:00" means "within five minutes of
// 15:00" — precise enough for social, and far cheaper than a per-post timer
// that would not survive a restart.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SocialPost from "@/models/SocialPost";
import { runSocialPost } from "@/lib/socialRun";

export const dynamic = "force-dynamic";

const MAX_PER_RUN = 5;      // keep one cron tick well inside any request timeout
const STUCK_MS = 15 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const now = new Date();

  // A stale request may have reached Meta. Require review, never auto-replay.
  await SocialPost.updateMany(
    { state: "publishing", updatedAt: { $lt: new Date(Date.now() - STUCK_MS) } },
    { $set: { state: "failed", lastError: "Илгээлт тасалдсан. Дахин нийтлэхээс өмнө сувгуудаа шалгана уу." } }
  );

  const done: Array<Record<string, unknown>> = [];

  for (let i = 0; i < MAX_PER_RUN; i++) {
    // Claim one job atomically so two overlapping ticks can never double-post.
    const job = await SocialPost.findOneAndUpdate(
      { state: "scheduled", scheduledAt: { $lte: now } },
      { $set: { state: "publishing" }, $inc: { attempts: 1 } },
      { sort: { scheduledAt: 1 }, new: true }
    );
    if (!job) break;

    try {
      const finished = await runSocialPost(job);
      done.push({ id: String(job._id), state: finished.state });
    } catch {
      await SocialPost.updateOne({ _id: job._id }, { $set: { state: "failed", lastError: "Илгээлтийн үр дүн тодорхойгүй. Сувгуудаа шалгана уу." } });
      done.push({ id: String(job._id), state: "failed" });
    }
  }

  const pending = await SocialPost.countDocuments({ state: "scheduled" });
  return NextResponse.json({ ok: true, processed: done.length, pending, done });
}
