import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface NewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
}

interface CacheEntry {
  at: number;
  date: string;
  items: NewsItem[];
}

// In-memory cache. The pm2 process is single-instance so this is correct;
// if we ever scale horizontally we'll move to Redis.
// Cache invalidates when the date rolls — so the homepage always reflects
// "today's hot news" even if the route hasn't been hit since yesterday.
let CACHE: CacheEntry | null = null;
const TTL_MS = 45 * 60 * 1000; // 45 min
// gpt-4o is more reliable about actually firing the web search tool; mini
// often skips the tool and hallucinates news from training data.
const MODEL = process.env.OPENAI_NEWS_MODEL || "gpt-4o";

// Today's topic. We anchor the prompt to the actual current date so cached
// model knowledge can't fool the search into returning week-old items.
const TODAY = () => new Date().toISOString().slice(0, 10);

const PROMPT = () => `Today is ${TODAY()}. Use the web search tool aggressively to surface 6 distinct AI news items published in the LAST 48 HOURS from major global English-language sources.

Search queries to try (run several): "AI news today", "OpenAI announcement", "Anthropic Claude", "Google Gemini", "Meta AI", "AI startup funding", "AI regulation", "AI agent breakthrough".
Prefer: techcrunch.com, theverge.com, reuters.com, bloomberg.com, ft.com, theinformation.com, anthropic.com, openai.com, deepmind.google, ai.meta.com, x.ai, news.ycombinator.com, theregister.com, axios.com, wired.com, arstechnica.com, semafor.com.
Topic universe: AI model releases, foundational research, AI startup funding, big-tech AI moves, regulation, agent/robotics breakthroughs.

You MUST translate the title and summary to Mongolian (Cyrillic) — do not leave English.

OUTPUT — return ONLY a single valid JSON object, no prose, no fences:
{"items":[{"title":"<Mongolian translation, max 90 chars>","url":"<canonical URL>","source":"<domain>","summary":"<1 sentence Mongolian, max 140 chars>"}, ...]}

Hard constraints:
- Return AT LEAST 3 items, up to 6. ORDER by impact + recency (newest first).
- Do NOT return fewer than 3. If a query yields nothing, run another.
- "title" + "summary" MUST be in Mongolian Cyrillic.
- "url" MUST be the actual published article URL — never the homepage.
- Drop duplicates, opinion pieces, rumour content, and pre-2026 items.`;

function safeParse(raw: string): NewsItem[] | null {
  // Strip code fences + look for the first { ... } block in case the model
  // adds prose despite instructions.
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  try {
    const parsed = JSON.parse(text) as { items?: unknown };
    if (!parsed.items || !Array.isArray(parsed.items)) return null;
    const items: NewsItem[] = [];
    for (const it of parsed.items) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.slice(0, 200) : "";
      const url = typeof o.url === "string" ? o.url : "";
      const source = typeof o.source === "string" ? o.source.slice(0, 60) : "";
      const summary = typeof o.summary === "string" ? o.summary.slice(0, 280) : "";
      if (title && url) {
        items.push({ title, url, source, summary });
      }
    }
    return items.slice(0, 3);
  } catch {
    return null;
  }
}

async function fetchFromOpenAI(): Promise<NewsItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);

  // Responses API + web_search_preview tool. The model itself decides when to
  // fire the search; we just pass the tool array and read output_text.
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: PROMPT(),
      tools: [
        {
          // Removed user_location lock — we want global AI news, not MN-only.
          type: "web_search_preview",
          search_context_size: "high",
        },
      ],
      // Force the model to actually search; without this, gpt-4o-mini frequently
      // shortcuts to training-data hallucinations of "iconic" AI announcements.
      tool_choice: { type: "web_search_preview" },
      max_output_tokens: 2000,
    }),
    signal: ctrl.signal,
  });
  clearTimeout(timer);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[mn-ai] openai upstream", res.status, t);
    throw new Error(`OpenAI ${res.status}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  // Walk both the convenience field and the structured output for the JSON blob.
  let content = "";
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

  const items = safeParse(content);
  if (!items || items.length === 0) {
    console.error("[mn-ai] unparseable content:", content.slice(0, 400));
    throw new Error("unparseable");
  }
  return items;
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  // Serve fresh cache only if same calendar day AND within TTL
  if (CACHE && CACHE.date === today && Date.now() - CACHE.at < TTL_MS) {
    return NextResponse.json({
      items: CACHE.items,
      cachedAt: CACHE.at,
      stale: false,
    });
  }

  try {
    const items = await fetchFromOpenAI();
    CACHE = { at: Date.now(), date: today, items };
    return NextResponse.json({ items, cachedAt: CACHE.at, stale: false });
  } catch (e) {
    // Fall back to last-known good cache even if expired — better than empty UI
    if (CACHE) {
      return NextResponse.json({
        items: CACHE.items,
        cachedAt: CACHE.at,
        stale: true,
      });
    }
    const msg = e instanceof Error ? e.message : "fetch failed";
    return NextResponse.json({ items: [], error: msg }, { status: 502 });
  }
}
