// Server-side push helper — sends Web Push notifications to user(s).
// Uses VAPID keys from env. Cleans stale subscriptions automatically.

import webpush from "web-push";
import dbConnect from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@antaqor.com";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

interface SubDoc {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function deliverToSubs(subs: SubDoc[], payload: PushPayload) {
  if (subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };
  if (!ensureConfigured()) return { sent: 0, failed: 0, cleaned: 0 };

  const stale: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    })
  );

  if (stale.length > 0) {
    await PushSubscription.deleteMany({ endpoint: { $in: stale } });
  }
  return { sent, failed, cleaned: stale.length };
}

/** Send a push to one specific user (all their devices). */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    await dbConnect();
    const subs = await PushSubscription.find({ userId }).lean<SubDoc[]>();
    return await deliverToSubs(subs, payload);
  } catch (e) {
    console.error("[push] sendPushToUser failed:", e);
    return { sent: 0, failed: 0, cleaned: 0 };
  }
}

/** Broadcast a push to every subscribed user (optionally excluding one). */
export async function sendPushBroadcast(payload: PushPayload, excludeUserId?: string) {
  try {
    await dbConnect();
    const filter: Record<string, unknown> = {};
    if (excludeUserId) filter.userId = { $ne: excludeUserId };
    const subs = await PushSubscription.find(filter).lean<SubDoc[]>();
    return await deliverToSubs(subs, payload);
  } catch (e) {
    console.error("[push] sendPushBroadcast failed:", e);
    return { sent: 0, failed: 0, cleaned: 0 };
  }
}
