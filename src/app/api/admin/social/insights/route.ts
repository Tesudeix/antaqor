import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import SocialInsight, { SocialPlaybook } from "@/models/SocialInsight";
import { accountInfo, primaryTarget, stats, sync, learn } from "@/lib/socialInsights";

/* GET  — аккаунт, статистик, шилдэг постууд, AI playbook (кэшээс).
   POST {action:"sync"} — Meta-аас дахин татаад playbook-ийг шинээр сурна. */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const t = await primaryTarget();
  const [accounts, st, top, recent, pb, last] = await Promise.all([
    t ? accountInfo(t) : Promise.resolve([]),
    stats(),
    SocialInsight.find({}).sort({ score: -1 }).limit(8).lean(),
    SocialInsight.find({}).sort({ postedAt: -1 }).limit(12).lean(),
    SocialPlaybook.findOne({ key: "antaqor" }).lean(),
    SocialInsight.findOne({}).sort({ syncedAt: -1 }).select("syncedAt").lean(),
  ]);
  return NextResponse.json({ accounts, stats: st, top, recent, playbook: pb, syncedAt: last?.syncedAt || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  if (b.action !== "sync") return NextResponse.json({ error: "action" }, { status: 400 });
  const s = await sync();
  let learned = false, learnError = "";
  try { await learn(); learned = true; } catch (e) { learnError = (e as Error).message; }
  return NextResponse.json({ ...s, learned, learnError });
}
