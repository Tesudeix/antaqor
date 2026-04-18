import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import dbConnect from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@antaqor.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: NextRequest) {
  try {
    // Simple auth check — extend with proper admin auth as needed
    const authHeader = req.headers.get("authorization");
    const adminKey = process.env.PUSH_ADMIN_KEY;
    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, body, url, userId, tag } = await req.json();
    if (!title || !body) {
      return NextResponse.json({ error: "title and body required" }, { status: 400 });
    }

    await dbConnect();

    // Target specific user or broadcast
    const filter = userId ? { userId } : {};
    const subs = await PushSubscription.find(filter).lean();

    const payload = JSON.stringify({ title, body, url: url || "/", tag: tag || "general" });

    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
            payload
          );
          sent++;
        } catch (err: unknown) {
          failed++;
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404 or 410 means subscription is expired/invalid
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(sub.endpoint);
          }
        }
      })
    );

    // Clean up stale subscriptions
    if (staleEndpoints.length > 0) {
      await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
    }

    return NextResponse.json({ sent, failed, cleaned: staleEndpoints.length });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
