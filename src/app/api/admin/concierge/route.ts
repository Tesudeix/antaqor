import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ConciergeConfig from "@/models/ConciergeConfig";
import ConciergeLog from "@/models/ConciergeLog";
import { ACCOUNT, bustConciergeCache, getConciergeConfig, loadCorpus, think, type Cfg } from "@/lib/concierge";

/* /admin/concierge — GET: тохиргоо + эх сурвалж + сүүлийн шийдвэрүүд,
   PUT: тохиргоо хадгалах, POST: «Туршиж үзэх» (юу ч илгээхгүй). */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const S = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const B = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const cfg = await getConciergeConfig(true);
  const [corpus, logs, stats] = await Promise.all([
    loadCorpus(),
    ConciergeLog.find({}).sort({ createdAt: -1 }).limit(40).lean(),
    ConciergeLog.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 86400_000) } } },
      { $group: { _id: "$action", n: { $sum: 1 } } },
    ]),
  ]);
  return NextResponse.json({
    cfg,
    sources: { threads: corpus.threads.length, feed: corpus.feed.length },
    logs,
    stats: Object.fromEntries(stats.map((s: { _id: string; n: number }) => [s._id, s.n])),
  });
}

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  await dbConnect();
  const set = {
    enabled: B(b.enabled, false),
    includeInstagram: B(b.includeInstagram, false),
    name: S(b.name, 60) || "Antaqor",
    about: S(b.about, 2000),
    offers: S(b.offers, 2500),
    facts: S(b.facts, 4000),
    goal: S(b.goal, 800),
    rules: S(b.rules, 1500),
    handoffPhone: S(b.handoffPhone, 30),
    address: b.address === "та" ? "та" : "чи",
    useThreads: B(b.useThreads, true),
    useFeed: B(b.useFeed, true),
    disclosure: B(b.disclosure, true),
    waitSec: Math.min(20, Math.max(0, Number(b.waitSec) || 6)),
    maxPerDay: Math.min(500, Math.max(0, Number(b.maxPerDay) || 30)),
  };
  await ConciergeConfig.findOneAndUpdate({ account: ACCOUNT }, { $set: set }, { upsert: true });
  bustConciergeCache();
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as { messages?: { from: string; text: string }[]; cfg?: Partial<Cfg>; refresh?: boolean };
  if (b.refresh) { const c = await loadCorpus(true); return NextResponse.json({ threads: c.threads.length, feed: c.feed.length }); }
  const saved = (await getConciergeConfig(true)) || ({} as Cfg);
  const cfg = { ...saved, ...(b.cfg || {}) } as Cfg;
  const transcript = (b.messages || []).slice(-14).map((m) => ({ from: (m.from === "me" ? "me" : "them") as "me" | "them", text: S(m.text, 600) })).filter((m) => m.text);
  if (!transcript.length) return NextResponse.json({ error: "empty" }, { status: 400 });
  const mine = transcript.filter((m) => m.from === "me").map((m) => m.text).slice(-4);
  const out = await think(cfg, transcript, "", mine);
  return NextResponse.json(out);
}
