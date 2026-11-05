import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ContentPlan from "@/models/ContentPlan";
import AgentBrand from "@/models/AgentBrand";
import SocialPost from "@/models/SocialPost";
import { SocialPlaybook } from "@/models/SocialInsight";
import { getBrand } from "@/lib/brandProfile";
import { ensureBrands, readiness, syncPlan, kick, createPlan, approveAll, externalQuery } from "@/lib/contentAgent";
import { DAY, weekStartOf, isoWeek, weekLabel, nextRun } from "@/lib/contentAgentRules";

/* Контент агент — нэг дэлгэцийн бүх төлөв (/admin/content-agent). */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await ensureBrands();
  const q = req.nextUrl.searchParams;
  const brands = await AgentBrand.find({}).sort({ createdAt: 1 }).lean();
  const brand = brands.find((b) => b.key === q.get("brand")) || brands[0];
  const weekRaw = q.get("week");
  const weekStart = weekStartOf(weekRaw && Number.isFinite(new Date(weekRaw).getTime()) ? new Date(weekRaw) : new Date());
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY);

  let plan = await ContentPlan.findOne({ brand: brand.key, weekStart, active: true }).lean();
  if (plan) {
    if (["planning", "writing"].includes(plan.status) && (!plan.lockedUntil || new Date(plan.lockedUntil) < new Date())) kick(plan._id);
    await syncPlan(plan._id);
    plan = await ContentPlan.findById(plan._id).lean();
  }
  const mine = (plan?.slots || []).map((s) => s.socialPostId).filter(Boolean);
  const [external, rows, playbook, voice] = await Promise.all([
    SocialPost.find(externalQuery(brand, weekStart, weekEnd, mine)).select("text brief platforms state imageUrl scheduledAt createdAt results").sort({ scheduledAt: 1 }).limit(60).lean(),
    ContentPlan.find({ brand: brand.key, active: true }).sort({ weekStart: -1 }).limit(16).select("weekStart status createdBy usd strategy.theme slots.status slots.metrics.score slots.edited").lean(),
    brand.kind === "personal" ? SocialPlaybook.findOne({ key: "antaqor" }).select("stats.bestDay stats.bestHour stats.bestFormat stats.total stats.avgScore ideas learnedAt").lean() : null,
    brand.kind === "personal" ? getBrand() : null,
  ]);
  const history = rows.map((p) => {
    const c = (st: string[]) => p.slots.filter((s) => st.includes(s.status)).length;
    const pub = p.slots.filter((s) => s.status === "published");
    return {
      _id: String(p._id), weekStart: p.weekStart, iso: isoWeek(p.weekStart), label: weekLabel(p.weekStart), status: p.status, theme: p.strategy?.theme || "", by: p.createdBy, usd: p.usd || 0,
      total: p.slots.length, approved: c(["scheduled", "publishing", "published", "failed"]), published: pub.length, skipped: c(["skipped"]), drafts: c(["draft"]),
      edited: p.slots.filter((s) => s.edited).length, score: pub.reduce((a, s) => a + (s.metrics?.score || 0), 0),
    };
  });
  const pb = playbook as { stats?: { bestDay?: string; bestHour?: string; bestFormat?: string; total?: number; avgScore?: number }; ideas?: string[]; learnedAt?: Date } | null;
  return NextResponse.json({
    now: new Date(),
    brands: brands.map((b) => ({ key: b.key, name: b.name, kind: b.kind, active: b.active, ready: readiness(b) })),
    brand: { ...brand, _id: String(brand._id) },
    ready: readiness(brand),
    nextRun: brand.active ? nextRun(brand.runWeekday, brand.runHour) : null,
    week: { start: weekStart, iso: isoWeek(weekStart), label: weekLabel(weekStart), isCurrent: weekStart.getTime() === weekStartOf(new Date()).getTime(), isPast: weekEnd.getTime() < Date.now() },
    plan: plan ? { ...plan, _id: String(plan._id) } : null,
    external: external.map((p) => ({ _id: String(p._id), at: p.scheduledAt || p.createdAt, text: p.text, brief: p.brief, platforms: p.platforms, state: p.state, imageUrl: p.imageUrl, permalink: p.results?.find((r) => r.permalink)?.permalink || "" })),
    history,
    insight: pb ? { bestDay: pb.stats?.bestDay || "", bestHour: pb.stats?.bestHour || "", bestFormat: pb.stats?.bestFormat || "", total: pb.stats?.total || 0, avgScore: pb.stats?.avgScore || 0, ideas: (pb.ideas || []).slice(0, 5), learnedAt: pb.learnedAt || null } : null,
    voice: voice ? { positioning: voice.positioning, tagline: voice.tagline, audience: voice.audience, values: (voice.values || []).map((v) => v.name) } : null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => ({}));
  await dbConnect();
  try {
    switch (body.action) {
      case "create": {
        const p = await createPlan(String(body.brand || ""), new Date(String(body.week || new Date().toISOString())), String(body.note || ""), session.user?.email || "admin", body.replace === true);
        return NextResponse.json({ ok: true, id: String(p._id) });
      }
      case "approveAll": return NextResponse.json({ ok: true, ...(await approveAll(String(body.planId || ""), session.user?.email || "")) });
      case "archive": {
        const r = await ContentPlan.updateOne({ _id: String(body.planId || ""), active: true }, { $set: { active: false, status: "archived" } });
        return r.modifiedCount ? NextResponse.json({ ok: true }) : fail("Төлөвлөгөө олдсонгүй", 404);
      }
      case "retry": {
        const r = await ContentPlan.updateOne({ _id: String(body.planId || ""), active: true, status: "failed" }, { $set: { status: "planning", error: "", slots: [] } });
        if (!r.modifiedCount) return fail("Зөвхөн амжилтгүй төлөвлөгөөг дахин эхлүүлнэ");
        kick(String(body.planId));
        return NextResponse.json({ ok: true });
      }
      default: return fail("Үйлдэл буруу");
    }
  } catch (e) { return fail((e as Error).message || "Алдаа"); }
}
