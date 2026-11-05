// Broadcast resume worker.
//
// The admin route marks a broadcast "sending" and fires `void runBroadcast()`.
// A detached promise does not reliably outlive the HTTP response, so a
// broadcast could sit in "sending" forever having delivered nothing — which is
// exactly what "broadcast doesn't work" looked like from the admin screen.
//
// This cron is the safety net: anything still "sending" whose worker heartbeat
// has gone stale gets picked up and finished. runBroadcast is already
// resume-safe (sentTo is persisted per delivery and the 24h frequency cap
// applies), so resuming never double-messages anyone.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaBroadcast from "@/models/MetaBroadcast";
import { runBroadcast } from "@/lib/metaBroadcastRun";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Long enough that a healthy worker is never mistaken for a dead one (it beats
// once per recipient, and each recipient takes well under a second).
const STALE_MS = 3 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await dbConnect();
  const cutoff = new Date(Date.now() - STALE_MS);

  const stalled = await MetaBroadcast.find({
    status: "sending",
    $or: [{ runningAt: { $exists: false } }, { runningAt: null }, { runningAt: { $lt: cutoff } }],
  })
    .select("_id name")
    .sort({ startedAt: 1 })
    .limit(3)
    .lean<{ _id: string; name?: string }[]>();

  const resumed: string[] = [];
  for (const b of stalled) {
    const id = String(b._id);
    // Claim it first, so two overlapping ticks cannot both resume the same run.
    const claimed = await MetaBroadcast.findOneAndUpdate(
      { _id: id, status: "sending", $or: [{ runningAt: { $exists: false } }, { runningAt: null }, { runningAt: { $lt: cutoff } }] },
      { $set: { runningAt: new Date() } }
    );
    if (!claimed) continue;
    resumed.push(id);
    await runBroadcast(id);
  }

  const sending = await MetaBroadcast.countDocuments({ status: "sending" });
  return NextResponse.json({ ok: true, resumed: resumed.length, ids: resumed, stillSending: sending });
}
