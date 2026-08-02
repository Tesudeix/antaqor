import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized, getThreadsClient } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsAutoReplyLog from "@/models/ThreadsAutoReplyLog";
import ThreadsTrigger from "@/models/ThreadsTrigger";
import ThreadsLead from "@/models/ThreadsLead";

// POST /api/admin/threads/automation-log/[id]/retry — re-run a failed action.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();

  const { id } = await params;
  const log = await ThreadsAutoReplyLog.findById(id);
  if (!log) return NextResponse.json({ error: "Лог олдсонгүй" }, { status: 404 });
  if (log.status !== "error") return NextResponse.json({ error: "Зөвхөн алдаатай мөрийг дахин оролдоно" }, { status: 400 });

  const trigger = log.triggerId ? await ThreadsTrigger.findById(log.triggerId) : null;
  if (!trigger) return NextResponse.json({ error: "Automation устсан байна" }, { status: 400 });

  const client = await getThreadsClient(log.accountId || undefined);
  if (!client) return NextResponse.json({ error: "Акаунт холбогдоогүй / дахин холбох шаардлагатай" }, { status: 400 });

  const wantsReply = trigger.action === "reply" || trigger.action === "reply_and_log" || !trigger.action;
  const wantsLead = trigger.action === "log_lead" || trigger.action === "reply_and_log";
  // For comments we reply to the comment id (== idempotency key); like events
  // use synthetic keys ("like:<post>:<n>") so the reply target is the post.
  const replyTo = log.eventType === "like" ? log.postId : log.replyId;

  try {
    let sentText = "";
    if (wantsReply && trigger.replyTemplate) {
      sentText = trigger.replyTemplate
        .replace(/\{\{\s*username\s*\}\}/gi, log.username ? `@${log.username}` : "")
        .replace(/\{\{\s*count\s*\}\}/gi, "")
        .trim();
      if (sentText) await client.createAndPublish(sentText, replyTo);
    }
    if (wantsLead && log.username) {
      await ThreadsLead.create({
        accountId: log.accountId, username: log.username, label: trigger.leadLabel || "lead",
        sourcePostId: log.postId, commentText: log.replyText,
        triggerId: trigger._id, triggerName: trigger.name,
      });
    }
    log.status = "sent";
    log.sentText = sentText.slice(0, 500);
    log.error = "";
    log.retryCount = (log.retryCount || 0) + 1;
    await log.save();
    await ThreadsTrigger.updateOne({ _id: trigger._id }, { $inc: { hitCount: 1 }, $set: { lastFiredAt: new Date() } });
    return NextResponse.json({ ok: true, log });
  } catch (err) {
    log.error = err instanceof Error ? err.message : "retry failed";
    log.retryCount = (log.retryCount || 0) + 1;
    await log.save();
    return NextResponse.json({ error: log.error }, { status: 502 });
  }
}
