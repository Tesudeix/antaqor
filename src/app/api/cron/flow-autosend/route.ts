// Cron tick — invoke every ~10 minutes to fire due Main-flow auto-sends.
// Protected by CRON_SECRET (?secret=...) — same scheme as the other cron routes.

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { runDueAutoSends } from "@/lib/flowAutoSend";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const expected = process.env.CRON_SECRET;
  if (expected && url.searchParams.get("secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const result = await runDueAutoSends();
  return NextResponse.json({ ok: true, ...result });
}
