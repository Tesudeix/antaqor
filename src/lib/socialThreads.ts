import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import SocialInsight from "@/models/SocialInsight";
import SocialSnapshot from "@/models/SocialSnapshot";

/* ─── Threads (өөрийн) пост + хэмжүүр синк (2026-10-18) ──────────────────
   Threads бол хамгийн том суваг (1.5k+ дагагч) — өмнө нь хэмжигддэггүй байв.
   Оноо = likes + 2×replies + 3×(reposts + quotes); views-ийг тусад нь. */

const G = "https://graph.threads.net/v1.0";
const dayUB = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar" }).format(new Date());

export async function threadsToken() {
  await dbConnect();
  return ThreadsToken.findOne({}).sort({ updatedAt: -1 }).lean<{ accessToken: string; username?: string; expiresAt?: Date; status?: string }>();
}

export async function threadsFollowers(): Promise<{ followers: number; username: string; ok: boolean; error?: string; expiresAt?: Date }> {
  const t = await threadsToken();
  if (!t?.accessToken) return { followers: 0, username: "", ok: false, error: "Threads холбогдоогүй" };
  const r = await fetch(`${G}/me/threads_insights?metric=followers_count&access_token=${t.accessToken}`, { signal: AbortSignal.timeout(15000) }).then((x) => x.json()).catch(() => ({ error: { message: "network" } }));
  if (r.error) return { followers: 0, username: t.username || "", ok: false, error: r.error.message, expiresAt: t.expiresAt };
  return { followers: r.data?.[0]?.total_value?.value || 0, username: t.username || "", ok: true, expiresAt: t.expiresAt };
}

export async function syncThreads(): Promise<{ threads: number; error?: string }> {
  const t = await threadsToken();
  if (!t?.accessToken) return { threads: 0, error: "Threads холбогдоогүй" };
  type P = { id: string; text?: string; timestamp: string; permalink?: string; media_type?: string; media_url?: string; thumbnail_url?: string };
  const r = await fetch(`${G}/me/threads?fields=id,text,timestamp,permalink,media_type,media_url,thumbnail_url&limit=50&access_token=${t.accessToken}`, { signal: AbortSignal.timeout(20000) }).then((x) => x.json()).catch(() => ({ error: { message: "network" } }));
  if (r.error) return { threads: 0, error: `Threads: ${r.error.message}` };
  let n = 0;
  for (const p of (r.data || []) as P[]) {
    if (p.media_type === "REPOST_FACADE") continue;
    const ins = await fetch(`${G}/${p.id}/insights?metric=views,likes,replies,reposts,quotes&access_token=${t.accessToken}`, { signal: AbortSignal.timeout(15000) }).then((x) => x.json()).catch(() => ({}));
    const v: Record<string, number> = {};
    for (const d of ins.data || []) v[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? 0;
    const likes = v.likes || 0, comments = v.replies || 0, shares = (v.reposts || 0) + (v.quotes || 0);
    await SocialInsight.updateOne({ externalId: `th_${p.id}` }, { $set: {
      platform: "threads", account: t.username || "threads", caption: p.text || "", mediaType: (p.media_type || "TEXT_POST").replace("_POST", "").replace("TEXT", "TEXT"),
      thumb: p.thumbnail_url || p.media_url || "", permalink: p.permalink || "", postedAt: new Date(p.timestamp),
      likes, comments, shares, saves: 0, reach: 0, views: v.views || 0, score: likes + 2 * comments + 3 * shares, syncedAt: new Date(),
    } }, { upsert: true });
    n++;
  }
  return { threads: n };
}

/** Суваг бүрийн дагагчийг өдөрт нэг удаа хадгална (сүүлийнх нь давамгайлна). */
export async function snapshot(rows: { platform: string; followers: number; posts?: number }[]) {
  await dbConnect();
  const day = dayUB();
  for (const r of rows) if (r.followers > 0) await SocialSnapshot.updateOne({ day, platform: r.platform }, { $set: { followers: r.followers, posts: r.posts || 0 } }, { upsert: true });
}
