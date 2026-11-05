import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import { Competitor, CompetitorPost, type ICompetitor } from "@/models/Competitor";
import { SocialPlaybook } from "@/models/SocialInsight";
import { primaryTarget, parseJson } from "@/lib/socialInsights";
import { providers, chatCompletion } from "@/lib/scoutProvider";
import { getBrand, brandPromptBlock } from "@/lib/brandProfile";

/* ─── Өрсөлдөгчийн контент задлах (2026-10-17) ─────────────────────────── */

const score = (likes: number, comments: number) => likes + 2 * comments;
const er = (s: number, followers: number) => (followers > 0 ? Math.round((s / followers) * 1000 * 10) / 10 : 0);
export const cleanHandle = (h: string) => String(h || "").trim().replace(/^https?:\/\/(www\.)?(instagram|threads|facebook)\.(com|net)\/(@)?/i, "").replace(/^@/, "").split(/[/?#]/)[0].slice(0, 60);

/** Алдааны кодыг ойлгомжтой болгоно; `perm` = эрх нээх товч харуулах. */
function explain(platform: string, e: { message?: string; code?: number } | undefined): string {
  if (!e) return "";
  if (e.code === 10 || e.code === 200) return platform === "threads" ? "perm:threads" : "perm:instagram";
  if (e.code === 110 || /does not exist|cannot be found/i.test(e.message || "")) return "Аккаунт олдсонгүй — business/creator аккаунт эсэхийг шалгана уу";
  return e.message || "Алдаа";
}

export async function syncCompetitor(c: ICompetitor): Promise<string> {
  await dbConnect();
  if (c.platform === "facebook") {
    c.error = "Facebook-ийн бусдын хуудсыг Meta API-аар уншиж болдоггүй — постыг нь гараар нэмнэ үү"; await c.save(); return c.error;
  }
  if (c.platform === "instagram") {
    const t = await primaryTarget();
    if (!t?.igId) { c.error = "Өөрийн Instagram холбогдоогүй"; await c.save(); return c.error; }
    type M = { id: string; caption?: string; like_count?: number; comments_count?: number; media_type?: string; timestamp: string; permalink?: string; media_url?: string; thumbnail_url?: string };
    const f = `business_discovery.username(${c.handle}){username,name,followers_count,profile_picture_url,media.limit(40){id,caption,like_count,comments_count,media_type,timestamp,permalink,media_url,thumbnail_url}}`;
    const r = await fetch(`https://graph.facebook.com/v21.0/${t.igId}?fields=${encodeURIComponent(f)}&access_token=${encodeURIComponent(t.igToken)}`, { signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({ error: { message: "network" } }));
    if (r.error) { c.error = explain("instagram", r.error); await c.save(); return c.error; }
    const bd = r.business_discovery || {};
    c.name = bd.name || bd.username || c.handle; c.followers = bd.followers_count || 0; c.avatar = bd.profile_picture_url || "";
    for (const m of (bd.media?.data || []) as M[]) {
      const s = score(m.like_count || 0, m.comments_count || 0);
      await CompetitorPost.updateOne({ externalId: `cig_${m.id}` }, { $set: {
        competitor: c._id, platform: "instagram", handle: c.handle, caption: m.caption || "", mediaType: m.media_type || "",
        thumb: m.thumbnail_url || m.media_url || "", permalink: m.permalink || "", postedAt: new Date(m.timestamp),
        likes: m.like_count || 0, comments: m.comments_count || 0, score: s, er: er(s, c.followers), manual: false,
      } }, { upsert: true });
    }
  }
  if (c.platform === "threads") {
    const tok = await ThreadsToken.findOne({}).sort({ updatedAt: -1 }).lean();
    if (!tok?.accessToken) { c.error = "Өөрийн Threads холбогдоогүй"; await c.save(); return c.error; }
    const base = "https://graph.threads.net/v1.0";
    const prof = await fetch(`${base}/profile_lookup?username=${encodeURIComponent(c.handle)}&fields=username,name,follower_count,profile_picture_url&access_token=${tok.accessToken}`).then((x) => x.json()).catch(() => ({ error: { message: "network" } }));
    if (prof.error) { c.error = explain("threads", prof.error); await c.save(); return c.error; }
    c.name = prof.name || prof.username || c.handle; c.followers = prof.follower_count || 0; c.avatar = prof.profile_picture_url || "";
    type T = { id: string; text?: string; like_count?: number; reply_count?: number; media_type?: string; timestamp: string; permalink?: string; media_url?: string };
    const posts = await fetch(`${base}/profile_posts?username=${encodeURIComponent(c.handle)}&fields=id,text,like_count,reply_count,media_type,timestamp,permalink,media_url&limit=40&access_token=${tok.accessToken}`).then((x) => x.json()).catch(() => ({}));
    for (const m of (posts.data || []) as T[]) {
      const s = score(m.like_count || 0, m.reply_count || 0);
      await CompetitorPost.updateOne({ externalId: `cth_${m.id}` }, { $set: {
        competitor: c._id, platform: "threads", handle: c.handle, caption: m.text || "", mediaType: m.media_type || "TEXT",
        thumb: m.media_url || "", permalink: m.permalink || "", postedAt: new Date(m.timestamp),
        likes: m.like_count || 0, comments: m.reply_count || 0, score: s, er: er(s, c.followers), manual: false,
      } }, { upsert: true });
    }
  }
  c.error = ""; c.lastSyncAt = new Date(); await c.save();
  return "";
}

export async function syncAll() {
  await dbConnect();
  const list = await Competitor.find({});
  const out: Record<string, string> = {};
  for (const c of list) out[`${c.platform}:${c.handle}`] = await syncCompetitor(c).catch((e) => (e as Error).message);
  return out;
}

async function llm(system: string, user: string, maxTokens = 1400) {
  const messages = [{ role: "system" as const, content: system }, { role: "user" as const, content: user }];
  for (const p of providers()) {
    try { const c = await chatCompletion(p, messages, { maxTokens, temperature: 0.6, reasoning: "none", timeoutMs: 45000 }); const raw = String(c?.message?.content || "").trim(); if (raw) return raw; } catch { /* next */ }
  }
  throw new Error("AI хариу өгсөнгүй");
}

export async function analyzePost(id: string) {
  await dbConnect();
  const p = await CompetitorPost.findById(id);
  if (!p) throw new Error("Пост олдсонгүй");
  const brand = await getBrand();
  const raw = await llm(
    "Чи сошиал контентын шинжээч. Өрсөлдөгчийн постыг ЯАГААД сайн ажилласныг задлаад, дараа нь энэ брэнд ХУУЛАХГҮЙГЭЭР өөрийн өнцгөөр яаж ашиглахыг санал болго. Монголоор. Зөвхөн JSON.\n" + brandPromptBlock(brand),
    `ПЛАТФОРМ: ${p.platform} · ${p.mediaType} · ❤${p.likes} 💬${p.comments} · ER ${p.er}/1000 дагагч\nТЕКСТ:\n${p.caption.slice(0, 1800)}\n\nJSON: {"hook":"эхний мөр юугаар татсан бэ","format":"бүтэц/формат","why":"яагаад ажилласан — 2 өгүүлбэр","emotion":"ямар сэтгэл хөдлөл","adapt":"Antaqor-ийн өнцгөөр нэг мөр постын санаа"}`,
    700
  );
  const j = parseJson<{ hook: string; format: string; why: string; emotion: string; adapt: string }>(raw);
  p.analysis = { hook: String(j.hook || ""), format: String(j.format || ""), why: String(j.why || ""), emotion: String(j.emotion || ""), adapt: String(j.adapt || "") };
  await p.save();
  return p.analysis;
}

export async function summarize() {
  await dbConnect();
  const [top, own, brand] = await Promise.all([
    CompetitorPost.find({ caption: { $nin: ["", null] } }).sort({ er: -1, score: -1 }).limit(12).lean(),
    SocialPlaybook.findOne({ key: "antaqor" }).lean(),
    getBrand(),
  ]);
  if (!top.length) throw new Error("Задлах өрсөлдөгчийн пост алга");
  const raw = await llm(
    "Чи сошиал стратегич. Өрсөлдөгчдийн шилдэг постууд ба брэндийн өөрийн playbook-ийг харьцуулж, юуг сурч болохыг гарга. Зохиохгүй, хуулахгүй. Монголоор. Зөвхөн JSON.\n" + brandPromptBlock(brand),
    `ӨРСӨЛДӨГЧДИЙН ШИЛДЭГ ПОСТ (ER = оноо/1000 дагагч):\n${top.map((t) => `[@${t.handle} ${t.platform}/${t.mediaType} ER ${t.er} ❤${t.likes} 💬${t.comments}]\n${t.caption.slice(0, 400)}`).join("\n\n")}\n\nБРЭНДИЙН ӨӨРИЙН PLAYBOOK: ${own ? JSON.stringify({ summary: own.summary, do: own.doList }) : "алга"}\n\n` +
    `JSON: {"summary":"2 өгүүлбэр","patterns":["тэдэнд давтагддаг ажилладаг хэв маяг ×4"],"gaps":["тэд хийдэг, брэнд хийдэггүй зүйл ×3"],"ideas":["брэндийн өнцгөөр шинэ постын санаа ×5"]}`,
    1400
  );
  const j = parseJson<{ summary: string; patterns: string[]; gaps: string[]; ideas: string[] }>(raw);
  return SocialPlaybook.findOneAndUpdate({ key: "competitors" }, { $set: {
    summary: String(j.summary || ""), doList: (j.patterns || []).slice(0, 6).map(String), avoid: (j.gaps || []).slice(0, 5).map(String),
    ideas: (j.ideas || []).slice(0, 6).map(String), hooks: [], stats: {}, learnedAt: new Date(),
  } }, { upsert: true, new: true }).lean();
}
