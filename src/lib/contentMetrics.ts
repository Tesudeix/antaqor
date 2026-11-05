import dbConnect from "@/lib/mongodb";
import ContentMetric, { MetricPlatform } from "@/models/ContentMetric";
import { getThreadsAccounts } from "@/lib/adminAuth";
import { listMetaTargets } from "@/lib/socialPublish";

/* ─── ОЛОН ХАЯГИЙН ҮЗҮҮЛЭЛТ ЦУГЛУУЛАХ ───────────────────────────────────
   Threads-ийн БҮХ холбогдсон хаяг, Meta-гийн БҮХ хуудас/IG-г гүйлгэнэ.
   Шинэ хаяг нэмэхэд энд юу ч засах шаардлагагүй — холбоход л хангалттай.

   Нэг хаягийн доголдол нь бусдыг зогсоохгүй: хаяг тус бүрээр try/catch.
   Үгүй бол нэг токен хугацаа дуусахад бүх анализ сохор болно. */

const GRAPH = "https://graph.facebook.com/v21.0";

export interface CollectReport {
  platform: MetricPlatform;
  account: string;
  saved: number;
  error?: string;
}

/** likes + 2×comments + 3×shares */
export function engagementOf(likes: number, comments: number, shares: number): number {
  return (likes || 0) + 2 * (comments || 0) + 3 * (shares || 0);
}

async function save(row: {
  platform: MetricPlatform; account: string; accountLabel: string;
  externalId: string; permalink?: string; text?: string; publishedAt?: Date;
  views?: number; likes?: number; comments?: number; shares?: number;
}) {
  await ContentMetric.updateOne(
    { platform: row.platform, externalId: row.externalId },
    {
      $set: {
        account: row.account,
        accountLabel: row.accountLabel,
        permalink: row.permalink || "",
        text: (row.text || "").slice(0, 2000),
        publishedAt: row.publishedAt,
        views: row.views || 0,
        likes: row.likes || 0,
        comments: row.comments || 0,
        shares: row.shares || 0,
        engagement: engagementOf(row.likes || 0, row.comments || 0, row.shares || 0),
        fetchedAt: new Date(),
      },
      $setOnInsert: { reuseCount: 0 },
    },
    { upsert: true },
  );
}

/* Graph-ийн insights нь [{name, values:[{value}]}] хэлбэртэй. */
function insightValue(data: unknown, name: string): number {
  const arr = (data as { data?: { name?: string; values?: { value?: number }[] }[] })?.data;
  if (!Array.isArray(arr)) return 0;
  return Number(arr.find((x) => x.name === name)?.values?.[0]?.value || 0);
}

async function graph(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(25_000) });
  const data = await res.json();
  if ((data as { error?: { message?: string } })?.error) {
    throw new Error((data as { error: { message: string } }).error.message);
  }
  return data;
}

/* ─── Threads — бүх хаяг ───────────────────────────────────────────── */
export async function collectThreads(limit = 25): Promise<CollectReport[]> {
  let accounts;
  try { accounts = await getThreadsAccounts(); }
  catch (e) { return [{ platform: "threads", account: "", saved: 0, error: (e as Error).message }]; }
  if (!accounts.length) return [{ platform: "threads", account: "", saved: 0, error: "Threads хаяг алга" }];

  return Promise.all(accounts.map(async ({ token, client }) => {
    const id = String((token as { threadsUserId?: string }).threadsUserId || "");
    const label = "@" + String((token as { username?: string }).username || id);
    try {
      const list = (await client.getThreads(limit)) as {
        data?: { id: string; text?: string; permalink?: string; timestamp?: string }[];
      };
      const posts = Array.isArray(list.data) ? list.data : [];
      let saved = 0;
      for (const p of posts) {
        if (!p.id) continue;
        let views = 0, likes = 0, replies = 0, reposts = 0, quotes = 0;
        try {
          const ins = await client.getThreadInsights(p.id);
          views = insightValue(ins, "views");
          likes = insightValue(ins, "likes");
          replies = insightValue(ins, "replies");
          reposts = insightValue(ins, "reposts");
          quotes = insightValue(ins, "quotes");
        } catch {
          /* Шинэ постод insights хоосон байж болно — пост өөрөө үнэтэй
             тул хэмжилтгүйгээр ч хадгална. */
        }
        await save({
          platform: "threads", account: id, accountLabel: label,
          externalId: p.id, permalink: p.permalink, text: p.text,
          publishedAt: p.timestamp ? new Date(p.timestamp) : undefined,
          views, likes, comments: replies, shares: reposts + quotes,
        });
        saved++;
      }
      return { platform: "threads" as const, account: label, saved };
    } catch (e) {
      return { platform: "threads" as const, account: label, saved: 0, error: (e as Error).message };
    }
  }));
}

/* ─── Instagram — бүх холбогдсон IG ────────────────────────────────── */
export async function collectInstagram(limit = 25): Promise<CollectReport[]> {
  const targets = (await listMetaTargets()).filter((t) => t.igId && t.igToken);
  if (!targets.length) return [{ platform: "instagram", account: "", saved: 0, error: "Instagram хаяг алга" }];

  return Promise.all(targets.map(async (t) => {
    try {
      const list = (await graph(`/${t.igId}/media`, {
        fields: "id,caption,permalink,timestamp,like_count,comments_count,media_type",
        limit: String(limit), access_token: t.igToken,
      })) as {
        data?: { id: string; caption?: string; permalink?: string; timestamp?: string;
                 like_count?: number; comments_count?: number }[];
      };
      const posts = Array.isArray(list.data) ? list.data : [];
      let saved = 0;
      for (const p of posts) {
        if (!p.id) continue;
        let views = 0;
        try {
          /* `reach` нь бүх төрөлд ажилладаг цорын ганц найдвартай хүрэлт. */
          const ins = await graph(`/${p.id}/insights`, { metric: "reach", access_token: t.igToken });
          views = insightValue(ins, "reach");
        } catch { /* хэмжилтгүй ч пост хадгалагдана */ }

        await save({
          platform: "instagram", account: t.key, accountLabel: t.label || t.key,
          externalId: p.id, permalink: p.permalink, text: p.caption,
          publishedAt: p.timestamp ? new Date(p.timestamp) : undefined,
          views, likes: p.like_count || 0, comments: p.comments_count || 0, shares: 0,
        });
        saved++;
      }
      return { platform: "instagram" as const, account: t.label || t.key, saved };
    } catch (e) {
      return { platform: "instagram" as const, account: t.label || t.key, saved: 0, error: (e as Error).message };
    }
  }));
}

/* ─── Facebook — бүх хуудас ────────────────────────────────────────── */
export async function collectFacebook(limit = 25): Promise<CollectReport[]> {
  const targets = (await listMetaTargets()).filter((t) => t.pageId && t.pageToken);
  if (!targets.length) return [{ platform: "facebook", account: "", saved: 0, error: "Facebook хуудас алга" }];

  return Promise.all(targets.map(async (t) => {
    try {
      const list = (await graph(`/${t.pageId}/posts`, {
        fields: "id,message,permalink_url,created_time,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)",
        limit: String(limit), access_token: t.pageToken,
      })) as {
        data?: {
          id: string; message?: string; permalink_url?: string; created_time?: string;
          shares?: { count?: number };
          reactions?: { summary?: { total_count?: number } };
          comments?: { summary?: { total_count?: number } };
        }[];
      };
      const posts = Array.isArray(list.data) ? list.data : [];
      let saved = 0;
      for (const p of posts) {
        if (!p.id) continue;
        let views = 0;
        try {
          const ins = await graph(`/${p.id}/insights`, {
            metric: "post_impressions_unique", access_token: t.pageToken,
          });
          views = insightValue(ins, "post_impressions_unique");
        } catch { /* хэмжилтгүй ч пост хадгалагдана */ }

        await save({
          platform: "facebook", account: t.key, accountLabel: t.label || t.key,
          externalId: p.id, permalink: p.permalink_url, text: p.message,
          publishedAt: p.created_time ? new Date(p.created_time) : undefined,
          views,
          likes: p.reactions?.summary?.total_count || 0,
          comments: p.comments?.summary?.total_count || 0,
          shares: p.shares?.count || 0,
        });
        saved++;
      }
      return { platform: "facebook" as const, account: t.label || t.key, saved };
    } catch (e) {
      return { platform: "facebook" as const, account: t.label || t.key, saved: 0, error: (e as Error).message };
    }
  }));
}

export async function collectAll(limit = 25): Promise<CollectReport[]> {
  await dbConnect();
  /* Гурван өөр API — зэрэг, нэг нь удаашрахад бусдыг хүлээлгэхгүй. */
  const groups = await Promise.all([collectThreads(limit), collectInstagram(limit), collectFacebook(limit)]);
  return groups.flat();
}
