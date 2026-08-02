import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_TAG_MODEL || "gpt-5-mini";
const ALLOWED_CATEGORIES = ["мэдээлэл", "ялалт", "промт", "бүтээл"] as const;
type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

interface AutoTagResult {
  category: AllowedCategory;
  tags: string[];
}

const PROMPT = (content: string) => `You are tagging a Mongolian community post for the Antaqor AI community.
Pick exactly ONE category from this list: ${ALLOWED_CATEGORIES.join(", ")}.
Then list up to 3 short Mongolian tags (1-2 words each, lowercase) that describe the post's topic.

Category meanings:
- "мэдээлэл" — news, info, AI updates, industry posts
- "ялалт" — wins, milestones, personal/business victories
- "промт" — sharing AI prompts, prompt techniques
- "бүтээл" — AI-generated creations, art, builds

POST:
"""
${content.slice(0, 1500)}
"""

Output ONLY a single JSON object — no prose, no fences:
{"category":"<one of the four>","tags":["<tag>","<tag>","<tag>"]}`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const burst = rateLimit(`auto-tag:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json({ error: "Дэндүү олон хүсэлт" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { content?: string };
  const content = (body.content || "").trim();
  if (content.length < 8) {
    return NextResponse.json({ error: "Контент богино" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: PROMPT(content),
        max_output_tokens: 200,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      console.error("[auto-tag] upstream", upstream.status, t.slice(0, 200));
      return NextResponse.json({ error: "AI failure" }, { status: 502 });
    }
    const data = (await upstream.json()) as {
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
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const f = text.indexOf("{");
    const l = text.lastIndexOf("}");
    if (f < 0 || l <= f) {
      return NextResponse.json({ error: "Parse fail" }, { status: 502 });
    }
    const parsed = JSON.parse(text.slice(f, l + 1)) as { category?: string; tags?: unknown };
    const cat = ALLOWED_CATEGORIES.includes(parsed.category as AllowedCategory)
      ? (parsed.category as AllowedCategory)
      : "ялалт";
    const tags: string[] = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase().slice(0, 24))
          .filter((t) => t.length > 0)
          .slice(0, 3)
      : [];

    const result: AutoTagResult = { category: cat, tags };
    return NextResponse.json(result);
  } catch (e) {
    console.error("[auto-tag] error", e);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }
}
