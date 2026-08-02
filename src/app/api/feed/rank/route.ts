import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_RANK_MODEL || "gpt-5-mini";
const TTL_MS = 8 * 60 * 1000; // 8 min — long enough to dedupe spam-refreshes
const MAX_RANK_INPUT = 30;     // hard cap on what we send the model

interface CacheEntry {
  at: number;
  signature: string; // hash of inputs — invalidates if posts change
  order: string[];   // post IDs ordered best→worst
}

// Per-user cache. Pm2 single-instance so memory map is fine.
const CACHE = new Map<string, CacheEntry>();

interface RankableSummary {
  id: string;
  category: string;
  excerpt: string;
  authorLevel: number;
  reactions: number;
  ageMinutes: number;
}

interface UserSignals {
  level: number;
  interests: string[];
  recentReactedCategories: string[]; // last few categories the user reacted to
}

function summarizeSignals(s: UserSignals): string {
  const parts: string[] = [];
  parts.push(`level=${s.level}`);
  if (s.interests.length) parts.push(`interests=${s.interests.slice(0, 6).join(",")}`);
  if (s.recentReactedCategories.length) {
    parts.push(`recently_engaged=${s.recentReactedCategories.slice(0, 5).join(",")}`);
  }
  return parts.join(" | ");
}

function buildPrompt(user: UserSignals, posts: RankableSummary[]): string {
  const userLine = summarizeSignals(user);
  const list = posts
    .map((p, i) => `[${i}] cat=${p.category} lvl=${p.authorLevel} reactions=${p.reactions} age=${p.ageMinutes}m :: ${p.excerpt}`)
    .join("\n");

  return `You are a feed-ranking model for the Antaqor community (AI-native Mongolian community).
You will receive a USER profile and a list of POSTS. Output an ordered ranking (best first) optimized for: relevance to the user, freshness, engagement quality, and topic diversity in the top 5.

USER: ${userLine}

POSTS (each is "[index] meta :: excerpt"):
${list}

Output ONLY a single JSON object — no prose, no code fences:
{"order":[<index>,<index>,...]}

Rules:
- Include EVERY index from the input exactly once.
- Strongly prioritize posts in categories the user has recently engaged with.
- Demote posts older than 1440m (24h) unless they have very high reactions.
- Avoid clustering 3+ posts in the same category at the top — vary categories among the first 5 slots.`;
}

async function rerankWithOpenAI(user: UserSignals, posts: RankableSummary[]): Promise<string[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt(user, posts),
        max_output_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("[feed/rank] upstream", res.status);
      return null;
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    let text = "";
    if (typeof data.output_text === "string") text = data.output_text.trim();
    else if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const b of data.output) for (const c of b.content || []) if (c.text) parts.push(c.text);
      text = parts.join("").trim();
    }
    // Strip fences if any
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const f = text.indexOf("{");
    const l = text.lastIndexOf("}");
    if (f < 0 || l <= f) return null;
    const parsed = JSON.parse(text.slice(f, l + 1)) as { order?: unknown };
    if (!Array.isArray(parsed.order)) return null;

    const ids: string[] = [];
    const seen = new Set<number>();
    for (const x of parsed.order) {
      const n = typeof x === "number" ? x : parseInt(String(x), 10);
      if (!Number.isFinite(n)) continue;
      if (n < 0 || n >= posts.length || seen.has(n)) continue;
      seen.add(n);
      ids.push(posts[n].id);
    }
    // If model dropped any, append the missing ones in their original order
    for (let i = 0; i < posts.length; i++) if (!seen.has(i)) ids.push(posts[i].id);
    return ids;
  } catch (e) {
    console.error("[feed/rank] error", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = (await req.json().catch(() => ({}))) as { postIds?: unknown };
  const requestedIds = Array.isArray(body.postIds)
    ? body.postIds.filter((s): s is string => typeof s === "string").slice(0, MAX_RANK_INPUT)
    : [];
  if (requestedIds.length < 4) {
    return NextResponse.json({ order: requestedIds });
  }

  // Cache key — same set of post IDs in same order = same rank.
  const signature = `${userId}::${requestedIds.join(",")}`;
  const hit = CACHE.get(userId);
  if (hit && hit.signature === signature && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ order: hit.order, cached: true });
  }

  await dbConnect();

  // ─── Pull user signals ───
  const userDoc = (await User.findById(userId)
    .select("level interests")
    .lean()) as unknown as { level?: number; interests?: string[] } | null;
  if (!userDoc) return NextResponse.json({ order: requestedIds });

  // Recent reaction signal — what categories they engaged with in last 14 days
  const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const recentReacted = (await Post.find({
    createdAt: { $gte: since },
    $or: [
      { likes: userId },
      // reactions Map: any reaction key contains this userId
      { [`reactions.love`]: userId },
      { [`reactions.fire`]: userId },
      { [`reactions.handshake`]: userId },
      { [`reactions.muscle`]: userId },
      { [`reactions.brain`]: userId },
    ],
  })
    .select("category")
    .limit(40)
    .lean()) as unknown as Array<{ category?: string }>;

  const reactedCats: string[] = [];
  const seenCat = new Set<string>();
  for (const p of recentReacted) {
    const c = p.category || "";
    if (c && !seenCat.has(c)) {
      seenCat.add(c);
      reactedCats.push(c);
      if (reactedCats.length >= 6) break;
    }
  }

  // ─── Pull post summaries for ranking ───
  const posts = (await Post.find({ _id: { $in: requestedIds } })
    .select("category content authorLevel likes reactions createdAt")
    .lean()) as unknown as Array<{
      _id: { toString(): string };
      category?: string;
      content?: string;
      authorLevel?: number;
      likes?: unknown[];
      reactions?: Record<string, unknown[]>;
      createdAt?: Date;
    }>;

  // Map back to requested order so summaries align with [index]
  const byId = new Map(posts.map((p) => [p._id.toString(), p]));
  const summaries: RankableSummary[] = requestedIds
    .map((id) => {
      const p = byId.get(id);
      if (!p) return null;
      const reacts = p.reactions
        ? Object.values(p.reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
        : 0;
      const total = reacts + (Array.isArray(p.likes) ? p.likes.length : 0);
      return {
        id,
        category: p.category || "пост",
        excerpt: (p.content || "").replace(/\s+/g, " ").trim().slice(0, 160),
        authorLevel: p.authorLevel || 1,
        reactions: total,
        ageMinutes: p.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 60000)) : 9999,
      };
    })
    .filter((x): x is RankableSummary => !!x);

  if (summaries.length < 4) {
    return NextResponse.json({ order: requestedIds });
  }

  const ranked = await rerankWithOpenAI(
    {
      level: userDoc.level || 1,
      interests: Array.isArray(userDoc.interests) ? userDoc.interests : [],
      recentReactedCategories: reactedCats,
    },
    summaries
  );

  if (!ranked) {
    // degrade gracefully — return requested order untouched
    return NextResponse.json({ order: requestedIds, fallback: true });
  }

  CACHE.set(userId, { at: Date.now(), signature, order: ranked });
  return NextResponse.json({ order: ranked });
}
