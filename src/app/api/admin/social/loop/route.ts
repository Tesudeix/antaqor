import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ContentMetric from "@/models/ContentMetric";
import ContentVariant from "@/models/ContentVariant";
import { getSettings, tick } from "@/lib/contentLoop";
import { getBrand } from "@/lib/brandProfile";
import { getThreadsSettings } from "@/models/ThreadsSettings";
import ThreadsAutoReplyLog from "@/models/ThreadsAutoReplyLog";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NETS = ["threads", "instagram", "facebook"];

/* Хугацааны цонх: 7 хоног, 30 хоног, бүгд. Тоонуудыг цонхонд нь
   хаасан нь санамсаргүй биш — "хамгийн сайн пост" гэдэг нь цонхоос
   хамаарч өөр хариулттай асуулт. */
function windowStart(w: string): Date | null {
  if (w === "7") return new Date(Date.now() - 7 * 86400_000);
  if (w === "30") return new Date(Date.now() - 30 * 86400_000);
  return null;
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();

  const w = req.nextUrl.searchParams.get("window") || "30";
  const acct = req.nextUrl.searchParams.get("account") || "";
  const from = windowStart(w);

  const base: Record<string, unknown> = {};
  if (from) base.publishedAt = { $gte: from };
  if (acct) base.account = acct;

  const [s, brand, th, aiLog, top, variants, pending, today, byAccount, totals] = await Promise.all([
    getSettings(),
    getBrand(),
    getThreadsSettings(),
    /* AI-ийн бичсэн хариултууд. Энэ жагсаалт нь чимэг биш: автомат
       хариулт эзний нэрээр НИЙТЭД гардаг тул юу бичигдсэнийг харах
       боломжгүй бол уг системийг асаах нь болгоомжгүй хэрэг. */
    ThreadsAutoReplyLog.find({ actionTaken: { $in: ["ai_reply", "ai_skip"] } })
      .sort({ createdAt: -1 }).limit(15).lean(),
    ContentMetric.find({ ...base, text: { $ne: "" } }).sort({ engagement: -1 }).limit(10).lean(),
    ContentVariant.find({}).sort({ createdAt: -1 }).limit(20).lean(),
    ContentVariant.countDocuments({ status: "pending" }),
    ContentVariant.countDocuments({ status: "published", publishedAt: { $gte: new Date(Date.now() - 86400_000) } }),
    ContentMetric.aggregate([
      { $match: base },
      {
        $group: {
          _id: { account: "$account", label: "$accountLabel", platform: "$platform" },
          posts: { $sum: 1 },
          engagement: { $sum: "$engagement" },
          views: { $sum: "$views" },
          best: { $max: "$engagement" },
        },
      },
      { $sort: { engagement: -1 } },
    ]),
    ContentMetric.aggregate([
      { $match: base },
      { $group: { _id: null, posts: { $sum: 1 }, engagement: { $sum: "$engagement" }, views: { $sum: "$views" } } },
    ]),
  ]);

  /* lean() нь Mongoose-ийн баримтын төрлийг буцаадаг тул
     Record<string, unknown> хүлээж авахгүй — ерөнхий төрлөөр авна. */
  const strip = <T extends { _id: unknown }>(r: T) => ({ ...r, _id: String(r._id) });

  return NextResponse.json({
    window: w,
    settings: {
      enabled: s.enabled, tickMinutes: s.tickMinutes, minGapMinutes: s.minGapMinutes,
      maxPerDay: s.maxPerDay, minAgeHours: s.minAgeHours, minEngagement: s.minEngagement,
      cooldownDays: s.cooldownDays, sourceWindowDays: s.sourceWindowDays,
      networks: s.networks, rewriteStrength: s.rewriteStrength,
      requireApproval: s.requireApproval,
      lastTickAt: s.lastTickAt, lastPostAt: s.lastPostAt, lastNote: s.lastNote,
    },
    brand: {
      positioning: brand.positioning, tagline: brand.tagline, audience: brand.audience,
      values: brand.values, avoid: brand.avoid, enabled: brand.enabled,
    },
    autoReply: {
      enabled: th.aiReplyEnabled,
      maxPerHour: th.aiReplyMaxPerHour,
      killSwitch: th.killSwitch,
      log: aiLog.map((r) => ({
        _id: String(r._id),
        username: r.username || "",
        incoming: r.replyText || "",
        sent: r.sentText || "",
        status: r.status,
        action: r.actionTaken || "",
        note: r.note || "",
        error: r.error || "",
        at: r.createdAt,
      })),
    },
    totals: totals[0] || { posts: 0, engagement: 0, views: 0 },
    byAccount: byAccount.map((r) => ({
      account: r._id.account || "", label: r._id.label || r._id.account || "—",
      platform: r._id.platform, posts: r.posts, engagement: r.engagement,
      views: r.views, best: r.best,
    })),
    top: top.map(strip),
    variants: variants.map(strip),
    counts: { pending, today },
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = await getSettings();

  /* Бүх тоог хязгаарт барина — дэлгэцээс 0 минут, 1000 пост гэж өгөхөд
     Meta-гийн хаалтад орох нь сайтын асуудал биш, хаягийн асуудал. */
  const num = (v: unknown, lo: number, hi: number, cur: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : cur;
  };

  if (typeof b.enabled === "boolean") s.enabled = b.enabled;
  if (typeof b.requireApproval === "boolean") s.requireApproval = b.requireApproval;
  if (b.tickMinutes !== undefined) s.tickMinutes = num(b.tickMinutes, 5, 720, s.tickMinutes);
  if (b.minGapMinutes !== undefined) s.minGapMinutes = num(b.minGapMinutes, 20, 2880, s.minGapMinutes);
  if (b.maxPerDay !== undefined) s.maxPerDay = num(b.maxPerDay, 1, 24, s.maxPerDay);
  if (b.minAgeHours !== undefined) s.minAgeHours = num(b.minAgeHours, 1, 720, s.minAgeHours);
  if (b.minEngagement !== undefined) s.minEngagement = num(b.minEngagement, 0, 10000, s.minEngagement);
  if (b.cooldownDays !== undefined) s.cooldownDays = num(b.cooldownDays, 1, 365, s.cooldownDays);
  if (b.sourceWindowDays !== undefined) s.sourceWindowDays = num(b.sourceWindowDays, 7, 1095, s.sourceWindowDays);
  if (Array.isArray(b.networks)) {
    const picked = (b.networks as unknown[]).map(String).filter((n) => NETS.includes(n));
    if (picked.length) s.networks = picked;
  }
  if (["light", "medium", "rework"].includes(String(b.rewriteStrength))) {
    s.rewriteStrength = String(b.rewriteStrength) as never;
  }
  await s.save();

  /* AI авто хариулт нь Threads-ийн автоматжуулалтын тохиргоонд амьдардаг
     (kill switch, цагийн хязгаар тэндээ). Хоёр тусдаа газар хадгалвал
     нэг нь нөгөөгөө үгүйсгэх эрсдэлтэй. */
  if (b.autoReply && typeof b.autoReply === "object") {
    const a = b.autoReply as Record<string, unknown>;
    const th = await getThreadsSettings();
    if (typeof a.enabled === "boolean") th.aiReplyEnabled = a.enabled;
    if (a.maxPerHour !== undefined) th.aiReplyMaxPerHour = num(a.maxPerHour, 1, 60, th.aiReplyMaxPerHour);
    if (typeof a.killSwitch === "boolean") th.killSwitch = a.killSwitch;
    await th.save();
  }

  return NextResponse.json({ ok: true });
}

/* "Одоо ажиллуул" товч — давталт унтраалттай ч үзүүлэлтээ шинэчилнэ. */
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    return NextResponse.json(await tick({ force: b.force === true }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
