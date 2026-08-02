import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import { findAgent } from "@/lib/empireAgents";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5-mini";
const AGENT_SLUG = "strategist";
const CATEGORY = "промт";

const PROMPT = (today: string) => `Today is ${today}. You are the Strategist agent of the Antaqor AI community in Mongolia.
Generate ONE "Prompt of the Day" — a single creative image-generation prompt that members can copy/paste into Nano Banana / gpt-image-2.

Output format — exactly two lines, in Mongolian (Cyrillic):

Line 1: A short hooky title (max 60 chars), e.g. "Өнөөдрийн промпт · ..."
Line 2: The actual prompt itself (60–180 chars), rich enough to produce a beautiful image. Subject + lighting + mood + style.

Then a blank line, then in English on a 4th line:
"PROMPT: <the same prompt translated to English so non-MN users can also use it>"

Rules:
- Stay in character as the Strategist (war-room, decisive, brief).
- Theme it with Mongolian cultural / cyber / future aesthetic when natural — but no kitsch.
- No "let me think", no "here is", no markdown headers. Just the two lines + the English line.
- Different theme every day — pick something fresh.`;

async function getOpenAIPrompt(): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const today = new Date().toISOString().slice(0, 10);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: PROMPT(today),
      max_output_tokens: 600,
    }),
    signal: ctrl.signal,
  });
  clearTimeout(timer);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
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
  if (!text) throw new Error("empty reply");
  return text;
}

// Reuse moderation from /lib/moderation if present, but ALSO accept this
// endpoint's bypass since we trust gpt-5-mini's own safety baseline.

async function handler(req: NextRequest): Promise<NextResponse> {
  // ─── Auth: shared secret in header (cron-only) ───
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("x-cron-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await dbConnect();

  // ─── Idempotency: skip if Strategist already posted today ───
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const existing = await Post.findOne({
    agentSlug: AGENT_SLUG,
    category: CATEGORY,
    createdAt: { $gte: todayStart },
  }).select("_id").lean();
  if (existing) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "already-posted-today",
    });
  }

  const agent = findAgent(AGENT_SLUG);
  if (!agent) {
    return NextResponse.json({ error: "agent missing" }, { status: 500 });
  }

  // ─── Find an admin user to attribute the post to ───
  // Posts require a real User _id as author. We pick the first admin role we find.
  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  if (!admin) {
    return NextResponse.json({ error: "no admin user" }, { status: 500 });
  }
  const adminId = (admin as unknown as { _id: { toString(): string } })._id.toString();

  // ─── Generate ───
  let content = "";
  try {
    content = await getOpenAIPrompt();
  } catch (e) {
    console.error("[daily-prompt] generation failed", e);
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }
  content = content.slice(0, 1900);
  // Sign with handle so it's clearly a Strategist drop
  if (!content.includes(agent.handle)) content += `\n\n— ${agent.handle}`;

  // ─── Persist ───
  const post = await Post.create({
    author: adminId,
    authorLevel: 5,
    content,
    image: "",
    images: [],
    visibility: "free",
    category: CATEGORY,
    agentSlug: agent.slug,
    likes: [],
    commentsCount: 0,
  });

  console.log(`[daily-prompt] posted ${post._id}`);
  return NextResponse.json({
    ok: true,
    postId: post._id.toString(),
    agent: agent.slug,
    excerpt: content.slice(0, 120),
  });
}

// Accept GET for the simplest cron-curl, POST for hardened setups.
export async function GET(req: NextRequest) { return handler(req); }
export async function POST(req: NextRequest) { return handler(req); }
