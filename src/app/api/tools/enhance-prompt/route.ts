import { IMAGE_PROMPT_LIMIT, imagePromptError } from "@/lib/imagePrompt";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const MODEL = process.env.OPENAI_ENHANCE_MODEL || "gpt-5-mini";

const SYSTEM = `You are a prompt-engineer for an image-generation tool (Nano Banana / gpt-image-2 / SeedDream).
Take the user's basic prompt and rewrite it as a single rich descriptive prompt — denser, more visual, more cinematic — without changing the user's intent.

Rules:
- Output ONLY the enhanced prompt, no preamble, no quotes, no markdown.
- Keep the user's original subject and language. If they wrote in Mongolian, keep Mongolian. If English, keep English.
- Add: lighting, lens/composition, mood, color palette, material/texture details, style references where relevant.
- For a short idea, expand it into a detailed 300–600 word prompt where useful. For a long brief, preserve every requirement, exact quoted text, names, numbers and layout instructions; do not summarize or pad it. Stay under 16,000 characters. No preamble.
- Never refuse — if the prompt seems dull, make it stunning. If it's already detailed, polish it.
- Do not invent watermarks, logos, signatures, or copyrighted IP.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const burst = rateLimit(`enhance:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json({ error: "Дэндүү олон хүсэлт" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const original = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (original.length < 2) {
    return NextResponse.json({ error: "Промпт богино" }, { status: 400 });
  }
  const validation = imagePromptError(original);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  try {

    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM },
          { role: "user", content: original },
        ],
        max_output_tokens: 10000,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      const t = await upstream.text().catch(() => "");
      console.error("[enhance] upstream", upstream.status, t.slice(0, 200));
      return NextResponse.json({ error: "AI failure" }, { status: 502 });
    }
    const data = (await upstream.json()) as {
      status?: string;
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (data.status === "incomplete") return NextResponse.json({ error: "AI бүрэн хариу өгсөнгүй. Эх текст хадгалагдсан тул дахин оролдоорой." }, { status: 502 });
    let text = "";
    if (typeof data.output_text === "string") text = data.output_text.trim();
    else if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const b of data.output) for (const c of b.content || []) if (c.text) parts.push(c.text);
      text = parts.join("").trim();
    }
    // Strip stray quotes/code fences if model added any
    text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (!text) return NextResponse.json({ error: "Empty reply" }, { status: 502 });
    if (text.length > IMAGE_PROMPT_LIMIT) return NextResponse.json({ error: "Сайжруулсан текст хэт урт байна. Эх текст хадгалагдсан." }, { status: 502 });
    return NextResponse.json({ prompt: text });
  } catch (e) {
    console.error("[enhance] error", e);
    return NextResponse.json({ error: "Network error" }, { status: 502 });
  }
}
