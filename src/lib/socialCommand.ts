import dbConnect from "@/lib/mongodb";
import SocialInsight from "@/models/SocialInsight";
import SocialSnapshot from "@/models/SocialSnapshot";
import SocialPost from "@/models/SocialPost";
import { Competitor, CompetitorPost } from "@/models/Competitor";
import ShopOrder from "@/models/ShopOrder";
import ShopProduct from "@/models/ShopProduct";
import { accountInfo, primaryTarget, parseJson } from "@/lib/socialInsights";
import { threadsFollowers } from "@/lib/socialThreads";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { getBrand, brandPromptBlock } from "@/lib/brandProfile";

/* ─── Сошиал хяналтын төв (2026-10-18) ───────────────────────────────────
   Менежментийн 4 асуулт: (1) Яг одоо юуг анхаарах вэ — alerts,
   (2) Суваг бүр ямар байна — channels, (3) Пост бүр яаж ажиллав (хаанаас ч
   нийтэлсэн) — timeline, (4) Гадаа юу ажиллаж байна — competitor pulse +
   research. Нэг дуудлагаар бүгд. */

const DAY = 864e5;
const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(d);
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export type Alert = { level: "high" | "mid" | "info"; title: string; detail: string; href?: string };

export async function command() {
  await dbConnect();
  const now = new Date();
  const t = await primaryTarget();
  const [meta, th] = await Promise.all([t ? accountInfo(t) : Promise.resolve([]), threadsFollowers()]);
  const accounts = [...meta.map((a) => ({ ...a })), { platform: "threads", name: th.username ? `@${th.username}` : "Threads", followers: th.followers, posts: 0, ok: th.ok, error: th.error }];

  const since30 = new Date(+now - 30 * DAY), since7 = new Date(+now - 7 * DAY);
  const [recent, snaps, scheduled, failed, stuck, lastSync] = await Promise.all([
    SocialInsight.find({ postedAt: { $gte: new Date(+now - 60 * DAY) } }).sort({ postedAt: -1 }).limit(150).lean(),
    SocialSnapshot.find({ day: { $gte: fmtDay(new Date(+now - 8 * DAY)) } }).sort({ day: 1 }).lean(),
    SocialPost.find({ state: "scheduled", scheduledAt: { $gte: now, $lte: new Date(+now + 14 * DAY) } }).sort({ scheduledAt: 1 }).select("text brief scheduledAt platforms").lean(),
    SocialPost.find({ state: "failed", updatedAt: { $gte: since7 } }).sort({ updatedAt: -1 }).limit(10).select("text lastError updatedAt").lean(),
    SocialPost.countDocuments({ state: "scheduled", scheduledAt: { $lt: new Date(+now - 30 * 60e3) } }),
    SocialInsight.findOne({}).sort({ syncedAt: -1 }).select("syncedAt").lean(),
  ]);

  /* ── channels ── */
  const channels = accounts.map((a) => {
    const posts = recent.filter((p) => p.platform === a.platform);
    const p30 = posts.filter((p) => +p.postedAt >= +since30), p7 = posts.filter((p) => +p.postedAt >= +since7);
    const ss = snaps.filter((s) => s.platform === a.platform);
    const first = ss[0]?.followers || 0;
    const avg = (l: typeof posts) => (l.length ? Math.round((l.reduce((x, p) => x + p.score, 0) / l.length) * 10) / 10 : 0);
    const top = [...p7].sort((x, y) => y.score - x.score)[0];
    return {
      platform: a.platform, name: a.name, followers: a.followers, ok: a.ok, error: a.error || "",
      growth7: first && a.followers ? a.followers - first : null,
      posts7: p7.length, posts30: p30.length, avg7: avg(p7), avg30: avg(p30),
      views7: p7.reduce((x, p) => x + (p.views || 0), 0),
      top: top ? { caption: top.caption.slice(0, 90), score: top.score, permalink: top.permalink } : null,
    };
  });

  /* ── timeline + хэвийн түвшинтэй харьцуулалт ── */
  const base: Record<string, number> = {};
  for (const pf of ["instagram", "facebook", "threads"]) base[pf] = median(recent.filter((p) => p.platform === pf).slice(0, 30).map((p) => p.score));
  const timeline = recent.slice(0, 40).map((p) => {
    const b = base[p.platform] || 0;
    const flag = b > 0 && p.score >= Math.max(3, b * 2) ? "hot" : b > 0 && p.score <= b * 0.5 && +p.postedAt < +now - DAY ? "cold" : "";
    return { id: String(p._id), platform: p.platform, caption: p.caption.slice(0, 140), thumb: p.thumb, permalink: p.permalink, postedAt: p.postedAt,
      likes: p.likes, comments: p.comments, shares: p.shares, views: p.views || 0, score: p.score, vsBase: b ? Math.round((p.score / b) * 10) / 10 : null, flag };
  });

  /* ── 14 хоногийн хуваарь ── */
  const calendar = Array.from({ length: 14 }, (_, i) => {
    const d = fmtDay(new Date(+now + i * DAY));
    const list = scheduled.filter((s) => s.scheduledAt && fmtDay(new Date(s.scheduledAt)) === d);
    return { day: d, count: list.length, items: list.map((s) => ({ id: String(s._id), text: (s.text || s.brief || "").slice(0, 80), at: s.scheduledAt, platforms: s.platforms })) };
  });

  /* ── өрсөлдөгчийн импульс: сүүлийн 72 цагт өөрийн дунджаасаа 2× ── */
  const comps = await Competitor.find({}).lean();
  const avgEr = new Map((await CompetitorPost.aggregate([{ $group: { _id: "$competitor", er: { $avg: "$er" }, sc: { $avg: "$score" } } }])).map((x) => [String(x._id), x]));
  const fresh = await CompetitorPost.find({ postedAt: { $gte: new Date(+now - 3 * DAY) } }).sort({ score: -1 }).limit(40).lean();
  const pulse = fresh.filter((p) => { const a = avgEr.get(String(p.competitor)); return a && (p.er ? p.er >= 2 * (a.er || 0) : p.score >= 2 * (a.sc || 0)); })
    .slice(0, 6).map((p) => ({ id: String(p._id), handle: p.handle, platform: p.platform, caption: p.caption.slice(0, 120), er: p.er, likes: p.likes, comments: p.comments, permalink: p.permalink, thumb: p.thumb }));

  /* ── shop ── */
  const [toShip, products] = await Promise.all([
    ShopOrder.countDocuments({ status: "paid" }),
    ShopProduct.find({ active: true }).select("name slug tagline price sizes images").sort({ sort: -1 }).limit(12).lean(),
  ]);

  /* ── alerts (менежерийн өглөөний жагсаалт) ── */
  const alerts: Alert[] = [];
  if (stuck) alerts.push({ level: "high", title: `${stuck} товлосон пост цагтаа гараагүй`, detail: "Хуваарийн cron эсвэл холболтоо шалгана уу", href: "/admin" });
  for (const f of failed.slice(0, 3)) alerts.push({ level: "high", title: "Нийтлэлт амжилтгүй болсон", detail: `${(f.text || "").slice(0, 60)} — ${f.lastError || "алдаа"}`, href: "/admin" });
  for (const a of accounts) if (!a.ok) alerts.push({ level: "high", title: `${a.platform} холболт тасарсан`, detail: a.error || "Дахин холбоно уу", href: "/admin" });
  if (th.expiresAt) { const d = Math.ceil((+new Date(th.expiresAt) - +now) / DAY); if (d <= 21) alerts.push({ level: d <= 7 ? "high" : "mid", title: `Threads холболт ${d} хоногийн дараа дуусна`, detail: "Content Studio → Холболт засах-аар сунгана", href: "/api/admin/threads/auth" }); }
  const gaps = calendar.slice(1, 8).filter((c) => !c.count).map((c) => c.day.slice(5));
  if (gaps.length) alerts.push({ level: gaps.length >= 4 ? "mid" : "info", title: `Ирэх 7 хоногт ${gaps.length} өдөр пост товлогдоогүй`, detail: gaps.join(", "), href: "/admin" });
  const age = lastSync?.syncedAt ? (+now - +new Date(lastSync.syncedAt)) / 36e5 : 999;
  if (age > 13) alerts.push({ level: "mid", title: "Сошиал өгөгдөл хуучирсан", detail: `Сүүлд ${Math.round(age)} цагийн өмнө татсан`, href: "" });
  if (pulse.length) alerts.push({ level: "info", title: `Өрсөлдөгчийн ${pulse.length} пост огцом өссөн`, detail: pulse.map((p) => "@" + p.handle).join(", "), href: "" });
  const cold = timeline.filter((x) => x.flag === "cold").slice(0, 3);
  if (cold.length) alerts.push({ level: "info", title: `${cold.length} пост таны хэвийн түвшнээс 2 дахин доогуур`, detail: "Яагаад гэдгийг Тойм → AI-ийн сурсан зүйл-ээс харна уу", href: "/admin" });
  if (toShip) alerts.push({ level: "high", title: `${toShip} дэлгүүрийн захиалга илгээгдээгүй`, detail: "Төлөгдсөн, хүргэлт хүлээж буй", href: "/admin/shop" });
  if (!comps.length) alerts.push({ level: "info", title: "Өрсөлдөгч нэмээгүй байна", detail: "Content Studio → Өрсөлдөгч — 3–5 аккаунт нэмбэл өдөр бүр хянагдана", href: "/admin" });
  const order = { high: 0, mid: 1, info: 2 } as const;
  alerts.sort((a, b) => order[a.level] - order[b.level]);

  return {
    syncedAt: lastSync?.syncedAt || null, channels, timeline, calendar, pulse, alerts,
    competitors: comps.length,
    shop: { toShip, products: products.map((p) => ({ name: p.name, slug: p.slug, tagline: p.tagline, price: p.price, soldOut: (p.sizes || []).every((s) => (s.stock || 0) <= 0), image: p.images?.[0] || "" })) },
  };
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function research(q: string) {
  await dbConnect();
  const re = new RegExp(esc(q.trim()).split(/\s+/).join("|"), "i");
  const [own, comp] = await Promise.all([
    SocialInsight.find({ caption: re }).sort({ score: -1 }).limit(25).lean(),
    CompetitorPost.find({ caption: re }).sort({ score: -1 }).limit(25).lean(),
  ]);
  const avg = (a: { score: number }[]) => (a.length ? Math.round((a.reduce((x, y) => x + y.score, 0) / a.length) * 10) / 10 : 0);
  return {
    own: own.map((p) => ({ id: String(p._id), platform: p.platform, caption: p.caption.slice(0, 220), score: p.score, likes: p.likes, comments: p.comments, views: p.views || 0, permalink: p.permalink, postedAt: p.postedAt })),
    competitors: comp.map((p) => ({ id: String(p._id), handle: p.handle, platform: p.platform, caption: p.caption.slice(0, 220), score: p.score, er: p.er, likes: p.likes, comments: p.comments, permalink: p.permalink })),
    stats: { own: own.length, ownAvg: avg(own), comp: comp.length, compAvg: avg(comp) },
  };
}

export async function brief(q: string) {
  const r = await research(q);
  if (!r.own.length && !r.competitors.length) throw new Error("Энэ сэдвээр пост олдсонгүй");
  const brand = await getBrand();
  const messages = [
    { role: "system" as const, content: "Чи сошиал судлаач. Зөвхөн өгөгдөлд тулгуурлан Монголоор товч судалгааны тайлан бич. Зохиохгүй. Зөвхөн JSON.\n" + brandPromptBlock(brand) },
    { role: "user" as const, content: `СЭДЭВ: "${q}"\n\nМИНИЙ ПОСТУУД (оноотой):\n${r.own.slice(0, 10).map((p) => `[${p.platform} · ${p.score}] ${p.caption}`).join("\n")}\n\nӨРСӨЛДӨГЧИД:\n${r.competitors.slice(0, 10).map((p) => `[@${p.handle} ${p.platform} · ${p.score}] ${p.caption}`).join("\n")}\n\nJSON: {"finding":"гол олдвор 2 өгүүлбэр","angles":["ажилласан өнцөг ×3"],"gap":"энэ сэдвээр надад дутуу зүйл 1 өгүүлбэр","ideas":["шинэ постын санаа ×3"]}` },
  ];
  for (const p of providers()) {
    try { const c = await chatCompletion(p, messages, { maxTokens: 900, temperature: 0.5, reasoning: "none", timeoutMs: 40000 }); const raw = String(c?.message?.content || ""); if (raw.trim()) return parseJson<{ finding: string; angles: string[]; gap: string; ideas: string[] }>(raw); } catch { /* next */ }
  }
  throw new Error("AI хариу өгсөнгүй");
}
