import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import Post from "@/models/Post";
import AiImage from "@/models/AiImage";
import AiVideo from "@/models/AiVideo";
import CompanionMessage from "@/models/CompanionMessage";
import Partnership from "@/models/Partnership";
import ShopOrder from "@/models/ShopOrder";

/* ─── /api/admin/dashboard?range=7|30|90 — Бизнесийн тойм (2026-10-17) ────
   Нэг дуудлагаар бүх самбар: KPI (одоо vs өмнөх ижил хугацаа + өдрийн цуваа),
   үндсэн график, сүүлийн үйлдэл, орлогын эх үүсвэр, шийдвэр хүлээж буй
   ажлууд, гишүүнчлэлийн төлөв. Өдрийг Улаанбаатарын цагаар тасална.
   АНХААР: төлөгдсөн төлбөрийн төлөв "paid" (хуучин analytics "approved"
   гэж хайгаад орлогыг үргэлж 0 гэж харуулж байсан). Төлөгдсөн огноо =
   updatedAt (pending → paid шилжих үед шинэчлэгдэнэ). */

export const dynamic = "force-dynamic";
const TZ = "Asia/Ulaanbaatar";
const DAY = 864e5;

type Bucket = { _id: string; v: number };

function days(from: Date, n: number): string[] {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
  return Array.from({ length: n }, (_, i) => f.format(new Date(from.getTime() + i * DAY)));
}
function series(keys: string[], rows: Bucket[]): number[] {
  const m = new Map(rows.map((r) => [r._id, r.v]));
  return keys.map((k) => m.get(k) || 0);
}
const byDay = (field: string) => ({ $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: TZ } });

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const range = [7, 30, 90].includes(Number(req.nextUrl.searchParams.get("range"))) ? Number(req.nextUrl.searchParams.get("range")) : 30;
  await dbConnect();

  const now = new Date();
  const start = new Date(now.getTime() - range * DAY);
  const prevStart = new Date(start.getTime() - range * DAY);
  /* 2×range өдөр, өнөөдрөөр дуусна: эхний хагас = өмнөх үе, сүүлийн хагас = одоо */
  const all = days(new Date(prevStart.getTime() + DAY), range * 2);
  const cur = all.slice(range), prev = all.slice(0, range);
  const since = prevStart;

  const paidMatch = { status: "paid", updatedAt: { $gte: since } };
  const [
    revRows, payCntRows, memPaidRows, signRows, aiImgRows, aiVidRows, chatRows,
    createdPayRows, activeMembers, expiring7, expiredEver, totalUsers, online, active24,
    sources, recentPays, recentUsers, recentPosts, recentShop,
    pendReceipt, pendReceiptOldest, abandoned48, abandonedAmt, shopToShip, partnersNew,
  ] = await Promise.all([
    Payment.aggregate<Bucket>([{ $match: paidMatch }, { $group: { _id: byDay("updatedAt"), v: { $sum: "$amount" } } }]),
    Payment.aggregate<Bucket>([{ $match: paidMatch }, { $group: { _id: byDay("updatedAt"), v: { $sum: 1 } } }]),
    Payment.aggregate<Bucket>([{ $match: { ...paidMatch, kind: "membership" } }, { $group: { _id: byDay("updatedAt"), v: { $sum: 1 } } }]),
    User.aggregate<Bucket>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: byDay("createdAt"), v: { $sum: 1 } } }]),
    AiImage.aggregate<Bucket>([{ $match: { createdAt: { $gte: since }, status: { $ne: "failed" } } }, { $group: { _id: byDay("createdAt"), v: { $sum: 1 } } }]),
    AiVideo.aggregate<Bucket>([{ $match: { createdAt: { $gte: since }, status: { $ne: "failed" } } }, { $group: { _id: byDay("createdAt"), v: { $sum: 1 } } }]),
    CompanionMessage.aggregate<Bucket>([{ $match: { createdAt: { $gte: since }, role: "user" } }, { $group: { _id: byDay("createdAt"), v: { $sum: 1 } } }]),
    Payment.aggregate<Bucket>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: byDay("createdAt"), v: { $sum: 1 } } }]),
    User.countDocuments({ subscriptionExpiresAt: { $gt: now } }),
    User.countDocuments({ subscriptionExpiresAt: { $gt: now, $lte: new Date(now.getTime() + 7 * DAY) } }),
    User.countDocuments({ subscriptionExpiresAt: { $lte: now } }),
    User.estimatedDocumentCount(),
    User.countDocuments({ lastSeenAt: { $gte: new Date(now.getTime() - 2 * 60e3) } }),
    User.countDocuments({ lastSeenAt: { $gte: new Date(now.getTime() - DAY) } }),
    /* орлогын эх үүсвэр — сонгосон хугацаанд үүссэн төлбөрүүд */
    Payment.aggregate<{ _id: { k: string; p: string }; paid: number; total: number; amount: number }>([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { k: { $ifNull: ["$kind", "membership"] }, p: { $ifNull: ["$plan", ""] } }, total: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        amount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] } } } },
      { $sort: { amount: -1, total: -1 } },
    ]),
    Payment.find({}).sort({ updatedAt: -1 }).limit(8).populate("user", "name").select("amount status kind plan updatedAt user").lean(),
    User.find({}).sort({ createdAt: -1 }).limit(6).select("name createdAt").lean(),
    Post.find({}).sort({ createdAt: -1 }).limit(4).populate("author", "name").select("content createdAt author").lean(),
    ShopOrder.find({}).sort({ createdAt: -1 }).limit(4).select("orderNo total status createdAt customer.name").lean(),
    Payment.countDocuments({ status: "pending", receiptImage: { $nin: ["", null] } }),
    Payment.findOne({ status: "pending", receiptImage: { $nin: ["", null] } }).sort({ createdAt: 1 }).select("createdAt").lean(),
    Payment.countDocuments({ status: "pending", receiptImage: { $in: ["", null] }, createdAt: { $gte: new Date(now.getTime() - 2 * DAY) } }),
    Payment.aggregate<{ v: number }>([{ $match: { status: "pending", receiptImage: { $in: ["", null] }, createdAt: { $gte: new Date(now.getTime() - 2 * DAY) } } }, { $group: { _id: null, v: { $sum: "$amount" } } }]),
    ShopOrder.countDocuments({ status: "paid" }),
    Partnership.countDocuments({ status: "new" }),
  ]);

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pack = (rows: Bucket[]) => { const c = series(cur, rows), p = series(prev, rows); return { series: c, prevSeries: p, value: sum(c), prev: sum(p) }; };
  const ai = (() => {
    const merged = new Map<string, number>();
    [...aiImgRows, ...aiVidRows, ...chatRows].forEach((r) => merged.set(r._id, (merged.get(r._id) || 0) + r.v));
    return pack([...merged].map(([k, v]) => ({ _id: k, v })));
  })();
  const revenue = pack(revRows), signups = pack(signRows), paidCnt = pack(payCntRows), created = pack(createdPayRows), members = pack(memPaidRows);
  const conv = {
    value: created.value ? Math.round((paidCnt.value / created.value) * 1000) / 10 : 0,
    prev: created.prev ? Math.round((paidCnt.prev / created.prev) * 1000) / 10 : 0,
    series: cur.map((_, i) => (created.series[i] ? Math.round((paidCnt.series[i] / created.series[i]) * 100) : 0)),
  };

  const planName: Record<string, string> = { starter: "Creator · Starter", builder: "Builder", operator: "Operator" };
  const label = (k: string, p: string) => (k === "credits" ? "Кредит багц" : k === "product" ? "Бүтээгдэхүүн" : planName[p] || "Гишүүнчлэл");
  const srcMap = new Map<string, { label: string; paid: number; total: number; amount: number }>();
  sources.forEach((s) => { const l = label(s._id.k, s._id.p); const x = srcMap.get(l) || { label: l, paid: 0, total: 0, amount: 0 }; x.paid += s.paid; x.total += s.total; x.amount += s.amount; srcMap.set(l, x); });

  type Act = { kind: string; title: string; sub: string; at: Date; tone: "ok" | "warn" | "bad" | "info" | "violet" };
  const acts: Act[] = [];
  recentPays.forEach((p) => {
    const who = (p.user as unknown as { name?: string } | null)?.name || "Хэрэглэгч";
    const what = p.kind === "credits" ? "кредит" : planName[p.plan] || "гишүүнчлэл";
    acts.push({ kind: "payment", at: p.updatedAt,
      title: `${who} — ${what} ${Number(p.amount).toLocaleString()}₮`,
      sub: p.status === "paid" ? "Төлбөр орсон" : p.status === "failed" ? "Амжилтгүй" : "Төлбөр хүлээгдэж байна",
      tone: p.status === "paid" ? "ok" : p.status === "failed" ? "bad" : "warn" });
  });
  recentUsers.forEach((u) => acts.push({ kind: "signup", at: u.createdAt, title: `${u.name || "Шинэ хэрэглэгч"} бүртгүүллээ`, sub: "Шинэ бүртгэл", tone: "violet" }));
  recentPosts.forEach((p) => acts.push({ kind: "post", at: p.createdAt, title: `${(p.author as unknown as { name?: string } | null)?.name || "Гишүүн"}: ${String(p.content || "").slice(0, 46) || "шинэ пост"}`, sub: "Feed дээр пост", tone: "info" }));
  recentShop.forEach((o) => acts.push({ kind: "shop", at: o.createdAt, title: `Дэлгүүр ${o.orderNo} — ${o.total.toLocaleString()}₮`, sub: o.status === "paid" ? "Илгээх хэрэгтэй" : o.status, tone: o.status === "paid" ? "ok" : "warn" }));
  acts.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const never = Math.max(0, totalUsers - activeMembers - expiredEver);
  return NextResponse.json({
    range, days: cur, online, active24,
    kpis: {
      revenue: { ...revenue },
      signups: { ...signups },
      members: { value: activeMembers, prev: activeMembers - members.value, series: members.series, gained: members.value },
      conversion: conv,
      ai: { ...ai },
    },
    chart: { revenue: revenue, signups: signups, payments: paidCnt },
    activity: acts.slice(0, 9),
    sources: [...srcMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 6),
    queue: [
      { key: "receipts", label: "Баримт шалгах төлбөр", sub: "Дансаар шилжүүлээд баримт илгээсэн", count: pendReceipt, oldest: pendReceiptOldest?.createdAt || null, href: "/admin/payments" },
      { key: "abandoned", label: "Дутуу үлдсэн checkout (48ц)", sub: `${(abandonedAmt[0]?.v || 0).toLocaleString()}₮ — залгаж эсвэл email-ээр сануул`, count: abandoned48, oldest: null, href: "/admin/payments" },
      { key: "ship", label: "Илгээх дэлгүүрийн захиалга", sub: "Төлөгдсөн, хүргэгдээгүй", count: shopToShip, oldest: null, href: "/admin/shop" },
      { key: "partners", label: "Шинэ хамтын ажиллагаа", sub: "Хариу хүлээж буй", count: partnersNew, oldest: null, href: "/admin/partnerships" },
    ],
    membership: { total: totalUsers, active: activeMembers - expiring7, expiring: expiring7, expired: expiredEver, never },
  }, { headers: { "Cache-Control": "no-store" } });
}
