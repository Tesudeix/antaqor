import { NextRequest, NextResponse } from "next/server";
import { learn } from "@/lib/socialInsights";
import { refreshAll } from "@/lib/socialRefresh";

/* 6 цаг тутам: бүх суваг + өрсөлдөгч + дагагчийн snapshot (?learn=0).
   Өдөрт нэг (02:00, ?learn=1): дээрхийг хийгээд AI playbook-ийг шинээр сурна.
   crontab: 0 *\/6 * * * …?secret=…&learn=0   ·   0 2 * * * …?secret=…&learn=1 */
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-key") || "";
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await refreshAll();
  let learned = false, learnError = "";
  if (req.nextUrl.searchParams.get("learn") !== "0") { try { await learn(); learned = true; } catch (e) { learnError = (e as Error).message; } }
  return NextResponse.json({ ...r, learned, learnError });
}
