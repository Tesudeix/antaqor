// AI provider abstraction for Meta DM replies.
// Default provider is Grok (xAI, OpenAI-compatible API). Falls back to OpenAI
// or Claude based on settings.provider.

import { findAgent } from "@/lib/empireAgents";
import type { IMetaSettings } from "@/models/MetaSettings";

const DM_RAILS = `

# Voice
Text like a founder friend in DMs. Short, sharp, low effort.
Hard cap: 1-2 өгүүлбэр, ~200 chars. Plain text only. No markdown, no headers, no bullet lists.
Emoji: ≤1 per reply, only if it earns its keep. Never 🤖.
Cool, confident, lightly playful. Mongol хэлээр асуувал монголоор хариул, ангилал биш найз шиг яриа.

# Identity (Meta TOS)
Та Antaqor-ын AI agent — founder Antaqor хүн биш.
"чи AI юу?" → "yep, AI 🙂"
Хүний нэрээр бүү жүжиглэ. Хувийн үзэл бодлоор бүү ярь — human team рүү redirect.

# Boundaries
Medical/legal/financial pro зөвлөгөө битгий өг → 1 өгүүлбэрээр зориулсан мэргэжилтэн руу чиглүүл.
Distress signal → нэг өгүүлбэрт acknowledge + «human» санал болго.
Illegal/Meta-against → 1 өгүүлбэр refuse + reason.

# Promo
Үнэ асуугаагүй бол бүү pitch хий. Cool бай.
Sign off natural — "as an AI" гэдэг шиг template-tail битгий тавь.`;

function buildSystemPrompt(settings: IMetaSettings | null, userContext?: string): string {
  const agent = findAgent("antaqor");
  const base = agent?.systemPrompt || "You are Antaqor, founder of antaqor.com.";
  const override = (settings?.systemPromptOverride || "").trim();
  const persona = override || base;
  const ctx = userContext ? `\n\n[Context about this user — only mention if they ask]\n${userContext}` : "";
  return persona + DM_RAILS + ctx;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

async function callGrok(
  model: string,
  system: string,
  user: string,
  history: ChatTurn[] = []
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          ...history.map((h) => ({ role: h.role, content: h.content.slice(0, 1000) })),
          { role: "user", content: user.slice(0, 2000) },
        ],
        max_tokens: 160,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`grok ${res.status} ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  model: string,
  system: string,
  user: string,
  history: ChatTurn[] = []
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          ...history.map((h) => ({ role: h.role, content: h.content.slice(0, 1000) })),
          { role: "user", content: user.slice(0, 2000) },
        ],
        max_output_tokens: 160,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`openai ${res.status} ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      return data.output_text.trim();
    }
    if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const block of data.output) {
        for (const c of block.content || []) {
          if (typeof c.text === "string") parts.push(c.text);
        }
      }
      return parts.join("").trim();
    }
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(
  model: string,
  system: string,
  user: string,
  history: ChatTurn[] = []
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system,
        max_tokens: 160,
        messages: [
          ...history.map((h) => ({ role: h.role, content: h.content.slice(0, 1000) })),
          { role: "user", content: user.slice(0, 2000) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`claude ${res.status} ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const parts: string[] = [];
    for (const c of data.content || []) {
      if (c.type === "text" && typeof c.text === "string") parts.push(c.text);
    }
    return parts.join("").trim();
  } finally {
    clearTimeout(timer);
  }
}

export async function generateReply(
  userText: string,
  settings: IMetaSettings | null,
  userContext?: string,
  history: ChatTurn[] = []
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const provider = settings?.provider || "grok";
  const model =
    settings?.aiModel ||
    (provider === "grok" ? "grok-4-fast-non-reasoning" : provider === "claude" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
  const system = buildSystemPrompt(settings, userContext);

  try {
    let text = "";
    if (provider === "grok") text = await callGrok(model, system, userText, history);
    else if (provider === "claude") text = await callClaude(model, system, userText, history);
    else text = await callOpenAI(model, system, userText, history);
    if (!text) return { ok: false, error: "empty response" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
