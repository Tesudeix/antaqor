import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { resumeDueSocialFlows } from "@/lib/socialFlowRun";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Delay node-той SocialFlow-уудын хугацаа болсон session-уудыг сэргээнэ.
// Crontab: */2 * * * * curl .../api/cron/social-flows?secret=$CRON_SECRET
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.nextUrl.searchParams.get("secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const resumed = await resumeDueSocialFlows();
  return NextResponse.json({ ok: true, resumed });
}
