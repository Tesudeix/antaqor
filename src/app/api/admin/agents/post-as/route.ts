import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import { findAgent, EMPIRE_AGENTS } from "@/lib/empireAgents";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5-mini";
const MAX_BRIEF_CHARS = 400;
const MAX_POST_CHARS = 800;

interface CommunityState {
  topCategory: { name: string; count: number } | null;
  recentPosts: Array<{ excerpt: string; category: string; ago: string }>;
  memberCount: number;
  todayDate: string;
}

async function gatherState(): Promise<CommunityState> {
  await dbConnect();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

  const [topAgg, recentAgg, memberCount] = await Promise.all([
    Post.aggregate([
      { $match: { createdAt: { $gte: since }, agentSlug: { $in: [null, ""] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    Post.find({ agentSlug: { $in: [null, ""] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("content category createdAt")
      .lean(),
    User.countDocuments({ banned: { $ne: true } }),
  ]);

  const topCategory = topAgg[0]
    ? { name: String(topAgg[0]._id || "пост"), count: topAgg[0].count }
    : null;

  const recentPosts = (recentAgg as unknown as Array<{ content?: string; category?: string; createdAt?: Date }>).map((p) => ({
    excerpt: (p.content || "").slice(0, 140).replace(/\s+/g, " ").trim(),
    category: p.category || "пост",
    ago: timeAgo(p.createdAt),
  })).filter((p) => p.excerpt.length > 0);

  return {
    topCategory,
    recentPosts,
    memberCount,
    todayDate: new Date().toISOString().slice(0, 10),
  };
}

function timeAgo(d?: Date): string {
  if (!d) return "?";
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildEngagementBrief(state: CommunityState, brief: string | undefined): string {
  const lines: string[] = [];
  lines.push("STATE OF THE ANTAQOR COMMUNITY (use this to ground your post — make it feel timely and aware):");
  lines.push(`- Today: ${state.todayDate}`);
  lines.push(`- Members: ${state.memberCount}`);
  if (state.topCategory) {
    lines.push(`- Trending category this week: ${state.topCategory.name} (${state.topCategory.count} posts)`);
  }
  if (state.recentPosts.length > 0) {
    lines.push("- Recent community posts:");
    for (const p of state.recentPosts) {
      lines.push(`  · [${p.category}] "${p.excerpt}" (${p.ago})`);
    }
  }
  if (brief && brief.trim()) {
    lines.push("");
    lines.push("ADMIN BRIEF (write the post around this): " + brief.trim().slice(0, MAX_BRIEF_CHARS));
  }
  lines.push("");
  lines.push("WRITE: a single feed post in your voice (1–3 short paragraphs OR 3–5 punchy lines). No greeting. No hashtags. No 'as an AI'. Mongolian or English — match the recent posts' language. End with one engagement hook (a question, a callout, or a challenge). Maximum 800 characters.");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const adminUserId = (session.user as { id: string }).id;

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    brief?: string;
    visibility?: "free" | "members";
    category?: string;
  };

  // ─── Resolve target agent ───
  // If no slug given, auto-pick: least-recently-posted agent.
  let slug = String(body.slug || "").toLowerCase();
  if (!slug) {
    await dbConnect();
    const lastByAgent = await Post.aggregate([
      { $match: { agentSlug: { $exists: true, $ne: "" } } },
      { $group: { _id: "$agentSlug", lastAt: { $max: "$createdAt" } } },
    ]);
    const lastMap = new Map<string, Date>(
      (lastByAgent as Array<{ _id: string; lastAt: Date }>).map((r) => [r._id, r.lastAt])
    );
    // Pick the agent with the oldest (or never) last-post; tier-weight excludes Sovereign.
    const candidates = EMPIRE_AGENTS.filter((a) => a.tier !== "sovereign");
    candidates.sort((a, b) => {
      const ta = lastMap.get(a.slug)?.getTime() || 0;
      const tb = lastMap.get(b.slug)?.getTime() || 0;
      return ta - tb;
    });
    slug = candidates[0]?.slug || "ceo";
  }

  const agent = findAgent(slug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // ─── Gather community state for grounding ───
  const state = await gatherState();
  const userBrief = buildEngagementBrief(state, body.brief);

  // ─── Call OpenAI ───
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  let content = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Агент өөрийн загвар зарлаагүй бол л нийтлэг утга. ANURA нь
        // gpt-5.6-terra шаарддаг — ялгах ажил нь бичих ажлаас хүнд.
        model: agent.model || MODEL,
        input: [
          { role: "system", content: agent.systemPrompt + "\n\nMODE: COMMUNITY POST. You are writing a public feed post for the Antaqor app — visible to all members. Stay in character. No system meta-commentary." },
          { role: "user", content: userBrief },
        ],
        max_output_tokens: 600,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("[agents/post-as] upstream", upstream.status, errText);
      return NextResponse.json({ error: "OpenAI failure" }, { status: 502 });
    }
    const data = (await upstream.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      content = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const block of data.output) {
        if (Array.isArray(block.content)) {
          for (const c of block.content) {
            if (c && typeof c.text === "string") parts.push(c.text);
          }
        }
      }
      content = parts.join("").trim();
    }
  } catch (e) {
    console.error("[agents/post-as] error", e);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: "Empty reply" }, { status: 502 });
  }

  // Strip any leaked system prefix the model occasionally drops
  content = content
    .replace(/^(STATE OF.*|MODE:.*|WRITE:.*|YOU ARE:.*)\s*/im, "")
    .slice(0, MAX_POST_CHARS)
    .trim();

  // Sign off with the agent's handle so it reads as authored even if avatar fails
  const signature = `\n\n— ${agent.handle}`;
  if (!content.endsWith(agent.handle)) content += signature;

  // ─── Persist ───
  await dbConnect();
  const visibility = body.visibility === "free" ? "free" : "members";
  const category = (body.category && body.category.trim()) || "пост";

  // authorLevel fallback — agents publish at level 5 so they show in mid-band feeds
  const post = await Post.create({
    author: adminUserId,
    authorLevel: 5,
    content,
    image: "",
    images: [],
    visibility,
    category,
    agentSlug: agent.slug,
    likes: [],
    commentsCount: 0,
  });

  return NextResponse.json({
    ok: true,
    postId: post._id.toString(),
    agent: agent.slug,
    content,
    visibility,
    category,
  });
}
