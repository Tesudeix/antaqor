// Nurture sequence engine.
// • enrollInNurture: enroll a (conversation, nurture) pair, schedule first step.
// • runDueSteps: invoked by cron — finds enrollments due, sends step DM, advances.
// • stopEnrollmentsForConversation: called when a user replies to a sequence (if step.stopOnReply).

import { Types } from "mongoose";
import MetaNurture from "@/models/MetaNurture";
import MetaNurtureEnrollment, {
  IMetaNurtureEnrollment,
} from "@/models/MetaNurtureEnrollment";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import { sendDm } from "@/lib/metaDm";
import type { MetaPlatform } from "@/models/MetaConversation";

const MAX_RUN_PER_TICK = 100;

export async function enrollInNurture(
  nurtureId: Types.ObjectId | string,
  conversationId: Types.ObjectId | string,
  platform: MetaPlatform,
  partnerId: string
): Promise<IMetaNurtureEnrollment | null> {
  const nurture = await MetaNurture.findById(nurtureId);
  if (!nurture || !nurture.enabled || nurture.steps.length === 0) return null;

  // Skip if already actively enrolled
  const existing = await MetaNurtureEnrollment.findOne({
    nurtureId,
    conversationId,
    status: "active",
  });
  if (existing) return existing;

  const firstDelay = nurture.steps[0].delayMinutes;
  const nextRunAt = new Date(Date.now() + firstDelay * 60_000);

  const created = await MetaNurtureEnrollment.create({
    nurtureId,
    conversationId,
    platform,
    partnerId,
    currentStep: 0,
    nextRunAt,
    status: "active",
  });
  await MetaNurture.updateOne({ _id: nurtureId }, { $inc: { enrolledCount: 1 } });
  return created;
}

export async function stopEnrollmentsForConversation(
  conversationId: Types.ObjectId | string,
  reason: string = "user_replied"
): Promise<number> {
  // Only stop enrollments whose CURRENT step has stopOnReply=true
  const active = await MetaNurtureEnrollment.find({
    conversationId,
    status: "active",
  });
  let count = 0;
  for (const e of active) {
    const nurture = await MetaNurture.findById(e.nurtureId);
    if (!nurture) continue;
    const step = nurture.steps[e.currentStep];
    if (step?.stopOnReply) {
      e.status = "stopped";
      e.stopReason = reason;
      await e.save();
      count++;
    }
  }
  return count;
}

export async function runDueSteps(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  stopped: number;
}> {
  const now = new Date();
  const due = await MetaNurtureEnrollment.find({
    status: "active",
    nextRunAt: { $lte: now },
  })
    .limit(MAX_RUN_PER_TICK)
    .sort({ nextRunAt: 1 });

  let sent = 0;
  let failed = 0;
  let stopped = 0;

  for (const e of due) {
    const nurture = await MetaNurture.findById(e.nurtureId);
    if (!nurture || !nurture.enabled) {
      e.status = "stopped";
      e.stopReason = "nurture_disabled";
      await e.save();
      stopped++;
      continue;
    }
    const conv = await MetaConversation.findById(e.conversationId);
    if (!conv) {
      e.status = "stopped";
      e.stopReason = "conversation_gone";
      await e.save();
      stopped++;
      continue;
    }
    if (conv.aiDisabled) {
      e.status = "stopped";
      e.stopReason = "ai_disabled";
      await e.save();
      stopped++;
      continue;
    }

    const step = nurture.steps[e.currentStep];
    if (!step) {
      // Completed
      e.status = "completed";
      e.completedAt = new Date();
      await e.save();
      await MetaNurture.updateOne({ _id: nurture._id }, { $inc: { completedCount: 1 } });
      continue;
    }

    const send = await sendDm(e.platform, e.partnerId, step.dmText, { account: ((conv as { account?: string }).account as "antaqor" | "joymassage" | "joybilliard") || "antaqor" });
    await MetaMessage.create({
      conversationId: e.conversationId,
      platform: e.platform,
      direction: "out",
      source: "ai",
      text: step.dmText,
      errorBody: send.ok ? "" : `${send.status} ${send.body}`.slice(0, 1000),
    });

    if (send.ok) {
      sent++;
      conv.lastMessagePreview = step.dmText.slice(0, 200);
      conv.lastMessageDirection = "out";
      conv.lastMessageAt = new Date();
      await conv.save();
    } else {
      failed++;
    }

    // Advance to next step
    e.currentStep += 1;
    const next = nurture.steps[e.currentStep];
    if (next) {
      e.nextRunAt = new Date(Date.now() + next.delayMinutes * 60_000);
    } else {
      e.status = "completed";
      e.completedAt = new Date();
      await MetaNurture.updateOne({ _id: nurture._id }, { $inc: { completedCount: 1 } });
    }
    await e.save();
  }

  return { processed: due.length, sent, failed, stopped };
}
