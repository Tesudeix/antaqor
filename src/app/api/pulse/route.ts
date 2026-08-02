import { NextResponse } from "next/server";
import { createHash } from "crypto";
import dbConnect from "@/lib/mongodb";
import PageView from "@/models/PageView";
import PageViewIp from "@/models/PageViewIp";

export const dynamic = "force-dynamic";

// Mongolia (Asia/Ulaanbaatar) is UTC+8 year-round, no DST — a fixed offset is
// enough and avoids pulling an Intl/tz dependency into a hot path.
function todayKey(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Behind nginx, so the real client is the first hop in x-forwarded-for.
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function hashIp(ip: string): string {
  return createHash("sha256").update("aq-pulse:" + ip).digest("hex");
}

// GET /api/pulse        → count this visitor once per IP per day, return total
// GET /api/pulse?peek=1 → read today's total without counting
//
// Accuracy: the day total only moves when a (day, ip) pair is inserted for
// the first time. Repeat hits from the same IP hit the unique index, throw
// E11000, and are silently ignored. Always responds 200 with a numeric
// `today` so the stats bar degrades to 0 rather than breaking.
export async function GET(req: Request) {
  const day = todayKey();
  try {
    await dbConnect();
    const peek = new URL(req.url).searchParams.get("peek") === "1";

    if (!peek) {
      const ip = hashIp(clientIp(req));
      try {
        await PageViewIp.create({ day, ip });
        // First time this IP is seen today → bump the day counter.
        await PageView.updateOne(
          { day },
          { $inc: { count: 1 } },
          { upsert: true }
        );
      } catch (e: unknown) {
        // Duplicate (day, ip) — already counted today. Anything else: ignore
        // too, the read below still returns the current total.
        const code = (e as { code?: number })?.code;
        if (code !== 11000) {
          // swallow — never let a counter write break the landing page
        }
      }
    }

    const doc = (await PageView.findOne({ day })
      .select("count")
      .lean()) as { count?: number } | null;

    return NextResponse.json(
      { today: doc?.count ?? 0, day },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { today: 0, day },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}
