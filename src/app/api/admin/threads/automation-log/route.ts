import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsAutoReplyLog from "@/models/ThreadsAutoReplyLog";
import ThreadsLead from "@/models/ThreadsLead";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || ""; // sent | error | skipped | seeded
  const eventType = sp.get("eventType") || ""; // comment | like
  const limit = Math.min(200, Math.max(10, Number(sp.get("limit")) || 50));

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  else query.status = { $in: ["sent", "error"] }; // default: meaningful rows only
  if (eventType) query.eventType = eventType;

  const logs = await ThreadsAutoReplyLog.find(query).sort({ createdAt: -1 }).limit(limit).lean();

  const [sent, errors, skipped, seeded, leads] = await Promise.all([
    ThreadsAutoReplyLog.countDocuments({ status: "sent" }),
    ThreadsAutoReplyLog.countDocuments({ status: "error" }),
    ThreadsAutoReplyLog.countDocuments({ status: "skipped" }),
    ThreadsAutoReplyLog.countDocuments({ status: "seeded" }),
    ThreadsLead.countDocuments({}),
  ]);

  const matched = sent + errors;
  const evaluated = matched + skipped;
  const counts = { sent, errors, skipped, seeded, matched, evaluated, seen: evaluated + seeded, leads };

  return NextResponse.json({ logs, counts });
}
