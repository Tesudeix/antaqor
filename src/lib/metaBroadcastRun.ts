// Broadcast send engine.
//
// A broadcast fans one message out to many conversations. The ONLY Meta-legal
// way to do this for promotional content is inside the 24-hour standard
// messaging window (messaging_type RESPONSE / STANDARD tag) — so the audience is
// always filtered to people whose last inbound message was < 24h ago. Sending
// promo content outside that window, under any message tag, gets the page
// banned. This module never uses a message tag.
//
// Guardrails baked in here:
//   • in-window only (WINDOW_MS) — re-checked per recipient at send time
//   • opt-out honoured (broadcastOptOut, set when a user texts STOP)
//   • frequency cap (FREQ_CAP_MS) — never message the same person twice in 24h
//   • skip escalated-to-human and ai-disabled conversations
//   • gentle pacing (~1 msg/sec) to stay under Meta rate limits
//   • auto-pause after a run of consecutive failures (token/permission issue)
//   • "[Реклам]" label on promo text (Mongolian Advertising Law)

import { Types } from "mongoose";
import MetaBroadcast from "@/models/MetaBroadcast";
import MetaConversation from "@/models/MetaConversation";
import MetaFlow, { IMetaFlow, IFlowCard } from "@/models/MetaFlow";
import MetaMessage from "@/models/MetaMessage";
import { startFlow } from "@/lib/metaFlowRun";
import { sendDm, sendImageAttachment, MetaPlatform } from "@/lib/metaDm";
import { applyReklamLabel } from "@/lib/metaCompliance";

const WINDOW_MS = 24 * 60 * 60 * 1000;  // Meta standard-messaging window
const FREQ_CAP_MS = 24 * 60 * 60 * 1000; // don't broadcast the same person twice in 24h
const MAX_AUDIENCE = 2000;               // hard ceiling per send (safety)
const PACING_MS = 800;                   // ~1 msg/sec base spacing

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AudienceSpec {
  platform: string;
  account: string;
  audience: { intentLabels: string[] };
}

// Build the Mongo filter for a broadcast's eligible audience at time `now`.
// Eligible = open conversation, in-window, not opted-out, not escalated, not
// ai-disabled, not messaged by a broadcast in the last 24h, and (optionally)
// matching one of the requested intent labels.
export function audienceFilter(b: AudienceSpec, now: number): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    account: b.account,
    status: "open",
    lastInboundAt: { $gte: new Date(now - WINDOW_MS) },
    broadcastOptOut: { $ne: true },
    escalatedToHuman: { $ne: true },
    aiDisabled: { $ne: true },
    $or: [
      { lastBroadcastAt: { $exists: false } },
      { lastBroadcastAt: null },
      { lastBroadcastAt: { $lt: new Date(now - FREQ_CAP_MS) } },
    ],
  };
  if (b.platform !== "both") filter.platform = b.platform;
  const labels = (b.audience?.intentLabels || []).filter(Boolean);
  if (labels.length) filter.intentLabel = { $in: labels };
  return filter;
}

export async function audienceCount(b: AudienceSpec): Promise<number> {
  const n = await MetaConversation.countDocuments(audienceFilter(b, Date.now()));
  return Math.min(n, MAX_AUDIENCE);
}

// Run a broadcast to completion. Detached worker — callers `void runBroadcast(id)`
// after marking it "sending". Safe to crash mid-run: sentTo + frequency cap mean
// a re-run never double-messages anyone.
export async function runBroadcast(broadcastId: string): Promise<void> {
  const b = await MetaBroadcast.findById(broadcastId);
  if (!b || b.status !== "sending") return;

  // Resolve flow content once up front.
  let flowMatch: { flow: IMetaFlow; card: IFlowCard } | null = null;
  if (b.contentType === "flow") {
    if (!b.flowId) {
      await MetaBroadcast.findByIdAndUpdate(b._id, { status: "failed", lastError: "Flow сонгоогүй", finishedAt: new Date() });
      return;
    }
    const flow = await MetaFlow.findById(b.flowId).lean<IMetaFlow>();
    if (!flow) {
      await MetaBroadcast.findByIdAndUpdate(b._id, { status: "failed", lastError: "Flow олдсонгүй", finishedAt: new Date() });
      return;
    }
    const card = (flow.cards || []).find((c) => c.id === flow.entryCardId) || flow.cards?.[0];
    if (!card) {
      await MetaBroadcast.findByIdAndUpdate(b._id, { status: "failed", lastError: "Flow-д карт алга", finishedAt: new Date() });
      return;
    }
    flowMatch = { flow, card };
  }

  const now = Date.now();
  const spec: AudienceSpec = { platform: b.platform, account: b.account, audience: b.audience };
  const recipients = await MetaConversation.find(audienceFilter(spec, now))
    .sort({ lastInboundAt: -1 })
    .limit(MAX_AUDIENCE)
    .lean<Array<{ _id: Types.ObjectId; platform: MetaPlatform; partnerId: string; lastInboundAt?: Date }>>();

  const already = new Set(b.sentTo);
  let accepted = 0, failed = 0, skipped = 0, consecutiveFailures = 0;
  await MetaBroadcast.findByIdAndUpdate(b._id, { "stats.targeted": recipients.length });

  for (let i = 0; i < recipients.length; i++) {
    // Honour a pause flag toggled by the admin mid-run.
    const fresh = await MetaBroadcast.findById(b._id).select("status").lean<{ status?: string }>();
    if (!fresh || fresh.status !== "sending") break;

    const conv = recipients[i];
    const key = `${conv.platform}:${conv.partnerId}`;
    if (already.has(key)) { skipped++; continue; }

    // Per-recipient re-check: the 24h window may have lapsed since the query,
    // and opt-out / escalation may have changed. Re-read the authoritative doc.
    const live = await MetaConversation.findById(conv._id)
      .select("lastInboundAt broadcastOptOut escalatedToHuman aiDisabled lastBroadcastAt account")
      .lean<{ lastInboundAt?: Date; broadcastOptOut?: boolean; escalatedToHuman?: boolean; aiDisabled?: boolean; lastBroadcastAt?: Date }>();
    const inboundMs = live?.lastInboundAt ? new Date(live.lastInboundAt).getTime() : 0;
    const lastBcMs = live?.lastBroadcastAt ? new Date(live.lastBroadcastAt).getTime() : 0;
    const stillEligible =
      live &&
      Date.now() - inboundMs < WINDOW_MS &&
      !live.broadcastOptOut &&
      !live.escalatedToHuman &&
      !live.aiDisabled &&
      (lastBcMs === 0 || Date.now() - lastBcMs >= FREQ_CAP_MS);
    if (!stillEligible) { skipped++; continue; }

    try {
      let ok = false;
      if (b.contentType === "flow" && flowMatch) {
        await startFlow(conv.platform, b.account, conv.partnerId, String(conv._id), flowMatch);
        ok = true; // startFlow swallows per-send errors; treat dispatch as accepted
      } else {
        const text = applyReklamLabel(b.text);
        if (b.imageUrl) {
          await sendImageAttachment(conv.platform, conv.partnerId, b.imageUrl, { account: b.account }).catch(() => {});
        }
        const res = await sendDm(conv.platform, conv.partnerId, text, { account: b.account });
        ok = res.ok;
        if (!ok) await MetaBroadcast.findByIdAndUpdate(b._id, { lastError: `${res.status}: ${res.body.slice(0, 200)}` });
        if (ok) {
          await MetaMessage.create({
            conversationId: conv._id,
            platform: conv.platform,
            direction: "out",
            source: "trigger",
            text: `[broadcast] ${text.slice(0, 200)}`,
          }).catch(() => {});
        }
      }

      if (ok) {
        accepted++;
        consecutiveFailures = 0;
        already.add(key);
        await MetaConversation.findByIdAndUpdate(conv._id, { lastBroadcastAt: new Date() }).catch(() => {});
        await MetaBroadcast.findByIdAndUpdate(b._id, {
          $addToSet: { sentTo: key },
          "stats.accepted": accepted,
        });
      } else {
        failed++;
        consecutiveFailures++;
        await MetaBroadcast.findByIdAndUpdate(b._id, { "stats.failed": failed });
      }
    } catch (e) {
      failed++;
      consecutiveFailures++;
      await MetaBroadcast.findByIdAndUpdate(b._id, {
        "stats.failed": failed,
        lastError: e instanceof Error ? e.message.slice(0, 200) : "send error",
      }).catch(() => {});
    }

    // A run of failures means a broken token / permission — stop burning the
    // audience and surface it as paused for the admin to investigate.
    if (consecutiveFailures >= 5) {
      await MetaBroadcast.findByIdAndUpdate(b._id, {
        status: "paused",
        lastError: "Дараалсан 5 алдаа — токен/эрх шалгана уу",
      });
      return;
    }

    await MetaBroadcast.findByIdAndUpdate(b._id, { "stats.skipped": skipped });
    // ~1 msg/sec with deterministic jitter (no Math.random — keeps runs reproducible).
    const pending = recipients.length - i;
    await sleep(PACING_MS + ((pending * 137) % 400) - 200);
  }

  const finalDoc = await MetaBroadcast.findById(b._id).select("status").lean<{ status?: string }>();
  if (finalDoc?.status === "sending") {
    await MetaBroadcast.findByIdAndUpdate(b._id, {
      status: "done",
      finishedAt: new Date(),
      "stats.accepted": accepted,
      "stats.failed": failed,
      "stats.skipped": skipped,
    });
  }
}
