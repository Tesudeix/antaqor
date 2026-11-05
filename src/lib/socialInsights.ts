import dbConnect from "@/lib/mongodb";
import { listMetaTargets, type MetaTarget } from "@/lib/socialPublish";
import SocialInsight, { SocialPlaybook } from "@/models/SocialInsight";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { getBrand, brandPromptBlock } from "@/lib/brandProfile";

/* ─── Сошиал өгөгдлөөс суралцах (2026-10-17) ─────────────────────────────
   sync()   — холбосон FB хуудас + IG бизнес аккаунтын сүүлийн 50 постыг
              хэмжүүртэй нь татна. Reach/saves/views нь `instagram_manage_
              insights` эрх шаарддаг; эрхгүй бол лайк/коммент/шэйрээр л
              оноо бодно (алдаа биш — `insightsAllowed:false` гэж тэмдэглэнэ).
   stats()  — формат, гараг, цаг бүрийн дундаж оноо (УБ цагаар).
   learn()  — шилдэг ба сул постуудаас AI "playbook" гаргана.
   examples() — AI бичигчид өгөх жишээ (шилдэг 6 + сул 3). */

const G = "https://graph.facebook.com/v21.0";
const TZ = "Asia/Ulaanbaatar";
const score = (x: { likes: number; comments: number; shares: number; saves: number }) => x.likes + 2 * x.comments + 3 * x.shares + 3 * x.saves;

async function gj<T = Record<string, unknown>>(path: string, token: string): Promise<T & { error?: { message: string; code: number } }> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${G}${path}${sep}access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r) return { error: { message: "network", code: 0 } } as T & { error: { message: string; code: number } };
  return r.json();
}

export async function primaryTarget(): Promise<MetaTarget | null> {
  const all = await listMetaTargets();
  return all.find((t) => t.key === "antaqor") || all[0] || null;
}

export type AccountInfo = { platform: "instagram" | "facebook"; name: string; followers: number; posts: number; ok: boolean; error?: string };

export async function accountInfo(t: MetaTarget): Promise<AccountInfo[]> {
  const out: AccountInfo[] = [];
  if (t.pageId && t.pageToken) {
    const fb = await gj<{ name?: string; followers_count?: number; fan_count?: number }>(`/${t.pageId}?fields=name,followers_count,fan_count`, t.pageToken);
    out.push({ platform: "facebook", name: fb.name || t.label, followers: fb.followers_count ?? fb.fan_count ?? 0, posts: 0, ok: !fb.error, error: fb.error?.message });
  }
  if (t.igId && t.igToken) {
    const ig = await gj<{ username?: string; followers_count?: number; media_count?: number }>(`/${t.igId}?fields=username,followers_count,media_count`, t.igToken);
    out.push({ platform: "instagram", name: ig.username ? `@${ig.username}` : "Instagram", followers: ig.followers_count || 0, posts: ig.media_count || 0, ok: !ig.error, error: ig.error?.message });
  }
  return out;
}

export async function sync(): Promise<{ instagram: number; facebook: number; insightsAllowed: boolean; errors: string[] }> {
  await dbConnect();
  const t = await primaryTarget();
  const res = { instagram: 0, facebook: 0, insightsAllowed: true, errors: [] as string[] };
  if (!t) { res.errors.push("Meta аккаунт холбогдоогүй"); return res; }
  const now = new Date();

  if (t.igId && t.igToken) {
    type M = { id: string; caption?: string; media_type?: string; media_product_type?: string; timestamp: string; like_count?: number; comments_count?: number; permalink?: string; media_url?: string; thumbnail_url?: string };
    const md = await gj<{ data?: M[] }>(`/${t.igId}/media?fields=id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink,media_url,thumbnail_url&limit=50`, t.igToken);
    if (md.error) res.errors.push(`Instagram: ${md.error.message}`);
    for (const m of md.data || []) {
      const x = { likes: m.like_count || 0, comments: m.comments_count || 0, shares: 0, saves: 0, reach: 0, views: 0 };
      if (res.insightsAllowed) {
        const isVid = m.media_type === "VIDEO" || m.media_product_type === "REELS";
        const ins = await gj<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`/${m.id}/insights?metric=${isVid ? "reach,saved,shares,views" : "reach,saved,shares"}`, t.igToken);
        if (ins.error) { if (ins.error.code === 10 || ins.error.code === 200) res.insightsAllowed = false; }
        else for (const d of ins.data || []) {
          const v = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
          if (d.name === "reach") x.reach = v; if (d.name === "saved") x.saves = v; if (d.name === "shares") x.shares = v; if (d.name === "views") x.views = v;
        }
      }
      await SocialInsight.updateOne({ externalId: `ig_${m.id}` }, { $set: {
        platform: "instagram", account: t.key, caption: m.caption || "", mediaType: m.media_product_type === "REELS" ? "REEL" : m.media_type || "",
        thumb: m.thumbnail_url || m.media_url || "", permalink: m.permalink || "", postedAt: new Date(m.timestamp), ...x, score: score(x), syncedAt: now,
      } }, { upsert: true });
      res.instagram++;
    }
  }

  if (t.pageId && t.pageToken) {
    type F = { id: string; message?: string; created_time: string; full_picture?: string; permalink_url?: string; reactions?: { summary?: { total_count: number } }; comments?: { summary?: { total_count: number } }; shares?: { count: number }; attachments?: { data?: { media_type?: string }[] } };
    const fp = await gj<{ data?: F[] }>(`/${t.pageId}/posts?fields=id,message,created_time,full_picture,permalink_url,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares,attachments{media_type}&limit=50`, t.pageToken);
    if (fp.error) res.errors.push(`Facebook: ${fp.error.message}`);
    for (const p of fp.data || []) {
      const x = { likes: p.reactions?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0, shares: p.shares?.count || 0, saves: 0, reach: 0, views: 0 };
      const mt = (p.attachments?.data?.[0]?.media_type || (p.full_picture ? "photo" : "text")).toUpperCase();
      await SocialInsight.updateOne({ externalId: `fb_${p.id}` }, { $set: {
        platform: "facebook", account: t.key, caption: p.message || "", mediaType: mt === "PHOTO" ? "IMAGE" : mt, thumb: p.full_picture || "",
        permalink: p.permalink_url || "", postedAt: new Date(p.created_time), ...x, score: score(x), syncedAt: now,
      } }, { upsert: true });
      res.facebook++;
    }
  }
  return res;
}

const WD = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
export async function stats(days = 90) {
  await dbConnect();
  const since = new Date(Date.now() - days * 864e5);
  const rows = await SocialInsight.find({ postedAt: { $gte: since } }).lean();
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const group = (key: (r: (typeof rows)[number]) => string) => {
    const m = new Map<string, number[]>();
    rows.forEach((r) => { const k = key(r); m.set(k, [...(m.get(k) || []), r.score]); });
    return [...m].map(([k, v]) => ({ key: k, n: v.length, avg: Math.round(avg(v) * 10) / 10 })).sort((a, b) => b.avg - a.avg);
  };
  const parts = (d: Date) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hour12: false }).formatToParts(d);
    const o: Record<string, string> = {}; p.forEach((x) => (o[x.type] = x.value));
    return { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday), h: Number(o.hour) % 24 };
  };
  const formats = group((r) => (r.mediaType === "REEL" || r.mediaType === "VIDEO" ? "Reel / видео" : r.mediaType === "CAROUSEL_ALBUM" || r.mediaType === "ALBUM" ? "Carousel" : r.mediaType === "IMAGE" ? "Зураг" : "Текст"));
  const weekdays = group((r) => WD[parts(r.postedAt).wd]);
  const hours = group((r) => { const h = parts(r.postedAt).h; const b = Math.floor(h / 3) * 3; return `${String(b).padStart(2, "0")}–${String(b + 3).padStart(2, "0")}`; });
  const lenB = group((r) => { const n = r.caption.length; return n < 80 ? "Богино (<80)" : n < 250 ? "Дунд (80–250)" : "Урт (250+)"; });
  const pick = (g: { key: string; n: number }[]) => g.find((x) => x.n >= 2)?.key || g[0]?.key || "—";
  const last30 = rows.filter((r) => +r.postedAt > Date.now() - 30 * 864e5);
  return {
    total: rows.length, last30: last30.length,
    avgScore: Math.round(avg(rows.map((r) => r.score)) * 10) / 10,
    avgLikes: Math.round(avg(rows.map((r) => r.likes)) * 10) / 10,
    avgComments: Math.round(avg(rows.map((r) => r.comments)) * 10) / 10,
    bestFormat: pick(formats), bestDay: pick(weekdays), bestHour: pick(hours), bestLength: pick(lenB),
    formats, weekdays, hours, lengths: lenB,
  };
}

export async function examples() {
  await dbConnect();
  const withCap = { caption: { $nin: ["", null] } };
  const [top, low] = await Promise.all([
    SocialInsight.find(withCap).sort({ score: -1 }).limit(8).lean(),
    SocialInsight.find({ ...withCap, postedAt: { $lte: new Date(Date.now() - 3 * 864e5) } }).sort({ score: 1 }).limit(4).lean(),
  ]);
  return { top, low };
}

async function llm(system: string, user: string, maxTokens = 1400): Promise<string> {
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  for (const p of providers()) {
    try {
      const c = await chatCompletion(p, messages, { maxTokens, temperature: 0.7, reasoning: "none", timeoutMs: 45000 });
      const raw = String(c?.message?.content || "").trim();
      if (raw) return raw;
    } catch { /* дараагийн provider */ }
  }
  throw new Error("AI хариу өгсөнгүй (provider-ууд ажиллахгүй байна)");
}
export function parseJson<T>(raw: string): T {
  const s = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  return JSON.parse(a >= 0 ? s.slice(a, b + 1) : s) as T;
}
const line = (r: { platform: string; mediaType: string; likes: number; comments: number; shares: number; saves: number; score: number; caption: string }) =>
  `[${r.platform}/${r.mediaType} · оноо ${r.score} · ❤${r.likes} 💬${r.comments}${r.shares ? ` ↗${r.shares}` : ""}${r.saves ? ` 🔖${r.saves}` : ""}]\n${r.caption.slice(0, 500)}`;

export async function learn() {
  const [st, ex, brand] = await Promise.all([stats(), examples(), getBrand()]);
  if (!ex.top.length) throw new Error("Суралцах пост алга — эхлээд sync хийнэ үү");
  const raw = await llm(
    "Чи Монгол хэлээр бичдэг сошиал медиа стратегич. Зөвхөн өгөгдөлд тулгуурла, зохиохгүй. Зөвхөн JSON буцаа.\n" + brandPromptBlock(brand),
    `Энэ бол брэндийн өөрийн Instagram/Facebook постуудын бодит үр дүн.\n\nСТАТИСТИК: ${JSON.stringify({ bestFormat: st.bestFormat, bestDay: st.bestDay, bestHour: st.bestHour, bestLength: st.bestLength, avgScore: st.avgScore, formats: st.formats, weekdays: st.weekdays })}\n\nШИЛДЭГ ПОСТУУД:\n${ex.top.map(line).join("\n\n")}\n\nСУЛ ПОСТУУД:\n${ex.low.map(line).join("\n\n")}\n\n` +
    `Шилдэг ба сул постуудыг харьцуулж юу ажилладгийг тодорхойл. JSON: {"summary":"2 өгүүлбэр — гол дүгнэлт","hooks":["шилдэг постуудад ажилласан эхлэлийн хэв маяг ×3"],"do":["тодорхой зөвлөгөө ×4"],"avoid":["сул постуудаас сурсан ×3"],"ideas":["энэ аудиторид ажиллах шинэ постын санаа ×5, нэг мөрөөр"]}`,
    1600
  );
  const j = parseJson<{ summary: string; hooks: string[]; do: string[]; avoid: string[]; ideas: string[] }>(raw);
  const doc = await SocialPlaybook.findOneAndUpdate({ key: "antaqor" }, { $set: {
    summary: String(j.summary || ""), hooks: (j.hooks || []).slice(0, 5).map(String), doList: (j.do || []).slice(0, 6).map(String),
    avoid: (j.avoid || []).slice(0, 5).map(String), ideas: (j.ideas || []).slice(0, 6).map(String), stats: st, learnedAt: new Date(),
  } }, { upsert: true, new: true }).lean();
  return doc;
}

export async function write(idea: string, format: string) {
  const [pb, ex, brand] = await Promise.all([SocialPlaybook.findOne({ key: "antaqor" }).lean(), examples(), getBrand()]);
  const raw = await llm(
    "Чи брэндийн өөрийнх нь дуу хоолойгоор Монгол хэлээр сошиал пост бичдэг. Доорх ШИЛДЭГ постуудын хэв маяг, урт, эхлэл, emoji хэрэглээг дуурай; СУЛ постуудын алдааг давтахгүй. Зохиомол тоо, баримт бүү бич. Зөвхөн JSON буцаа.\n" + brandPromptBlock(brand),
    `PLAYBOOK: ${pb ? JSON.stringify({ summary: pb.summary, hooks: pb.hooks, do: pb.doList, avoid: pb.avoid, best: pb.stats }) : "алга"}\n\nШИЛДЭГ ПОСТУУД:\n${ex.top.slice(0, 6).map(line).join("\n\n")}\n\nСУЛ ПОСТУУД:\n${ex.low.slice(0, 3).map(line).join("\n\n")}\n\n` +
    `ДААЛГАВАР: "${idea}" санаагаар ${format === "reel" ? "Reel-ийн тайлбар" : format === "text" ? "текст пост" : "зурагтай пост"} бич. 3 өөр хувилбар (өөр эхлэлтэй). Оноо = шилдэг постуудын хэв маягт хэр нийцсэнээр 1–100 таамагла.\n` +
    `JSON: {"variants":[{"caption":"бүтэн текст, hashtag-тай","hook":"эхний мөр","score":0,"why":"яагаад ажиллах вэ — 1 өгүүлбэр"}]}`,
    1800
  );
  const j = parseJson<{ variants: { caption: string; hook: string; score: number; why: string }[] }>(raw);
  return (j.variants || []).slice(0, 3).map((v) => ({ caption: String(v.caption || ""), hook: String(v.hook || ""), score: Math.max(1, Math.min(100, Math.round(Number(v.score) || 50))), why: String(v.why || "") }));
}
