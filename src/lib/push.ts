// ─── Server-side Web Push sender ───
// Any server route can fire a push to a specific user or to all admins.
// Used by: receipt upload (notify admin), approval (notify user), rejection (notify user),
// level-up, referral events, etc.

import webpush from "web-push";
import dbConnect from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@antaqor.com";

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
}

interface SendResult {
  sent: number;
  failed: number;
  cleaned: number;
}

async function sendToSubs(
  subs: { endpoint: string; keys: { p256dh: string; auth: string } }[],
  payload: PushPayload
): Promise<SendResult> {
  if (!ensureVapid()) return { sent: 0, failed: 0, cleaned: 0 };
  if (subs.length === 0) return { sent: 0, failed: 0, cleaned: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "general",
    icon: payload.icon || "/favicon.png",
  });

  const staleEndpoints: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  let cleaned = 0;
  if (staleEndpoints.length > 0) {
    const res = await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
    cleaned = res.deletedCount || 0;
  }

  return { sent, failed, cleaned };
}

/** Send push to a single user's all devices. Non-blocking on failure. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  try {
    await dbConnect();
    const subs = await PushSubscription.find({ userId: String(userId) }).lean();
    return sendToSubs(subs, payload);
  } catch {
    return { sent: 0, failed: 0, cleaned: 0 };
  }
}

/** Send push to every admin-role user. Good for "new payment claimed" alerts. */
export async function pushToAdmins(payload: PushPayload): Promise<SendResult> {
  try {
    await dbConnect();
    const admins = await User.find({ role: "admin" }).select("_id").lean();
    const adminIds = (admins as unknown as { _id: { toString(): string } }[]).map((a) => a._id.toString());
    if (adminIds.length === 0) return { sent: 0, failed: 0, cleaned: 0 };
    const subs = await PushSubscription.find({ userId: { $in: adminIds } }).lean();
    return sendToSubs(subs, payload);
  } catch {
    return { sent: 0, failed: 0, cleaned: 0 };
  }
}
