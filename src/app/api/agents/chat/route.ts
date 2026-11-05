import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { findAgent } from "@/lib/empireAgents";

export const dynamic = "force-dynamic";

const COST = 100; // 2026-10-26: 1кр=₮1 (өмнө 1кр=₮100)
const REASON = "AI_AGENT_CHAT";
const MAX_TURNS = 12;
const MAX_USER_CHARS = 2000;
const MODEL = process.env.OPENAI_AGENT_MODEL || "gpt-5-mini";

interface ClientMsg {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтэрнэ үү" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // Burst guard
  const burst = rateLimit(`ai-agent:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү хурдан. ${Math.ceil(burst.resetInMs / 1000)}с хүлээнэ үү.` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    messages?: ClientMsg[];
  };
  const slug = String(body.slug || "").toLowerCase();
  const agent = findAgent(slug);
  if (!agent) {
    return NextResponse.json({ error: "Агент олдсонгүй" }, { status: 404 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Мессеж хоосон" }, { status: 400 });
  }
  const last = incoming[incoming.length - 1];
  if (!last || last.role !== "user" || !last.content?.trim()) {
    return NextResponse.json({ error: "Хүчингүй формат" }, { status: 400 });
  }

  // Sanitize + clamp
  const trimmed: ClientMsg[] = incoming
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_USER_CHARS) }))
    .slice(-MAX_TURNS);

  // Charge first (atomic). Refund on upstream failure.
  const spend = await spendCredits({
    userId,
    amount: COST,
    reason: REASON,
    ref: agent.slug,
    meta: { slug: agent.slug, model: agent.model || MODEL },
  });
  if (!spend.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй (${spend.balance}/${COST}).`, credits: spend.balance },
      { status: 402 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await refundCredits({ userId, amount: COST, reason: REASON, ref: agent.slug });
    return NextResponse.json({ error: "OpenAI тохиргоо байхгүй" }, { status: 500 });
  }

  // ─── Personalisation: inject user's name into the system prompt ───
  // Lets CEO etc. greet the user by name and route them sharply on first turn.
  // We don't expose private fields — just the display name and email-domain
  // hint (so agents can mirror Mongolian/English language without asking).
  const sessionUser = session.user as { id?: string; name?: string; email?: string };
  const userName = (sessionUser?.name || "").trim();
  const userEmail = (sessionUser?.email || "").toLowerCase();
  const personalContext = userName
    ? `\n\nUSER PROFILE:\n- Name: ${userName.slice(0, 80)}\n- Email domain: ${userEmail.split("@")[1] || "?"}\nWhen useful, address them by name on the first turn. If they mention a domain or business already, reflect it back. Never ask for their name — you already have it.`
    : "";

  // ─── OpenAI Responses API call ───
  // input is an array of messages with "role" and "content".
  const input = [
    { role: "system", content: agent.systemPrompt + personalContext },
    ...trimmed,
  ];

  let reply = "";
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
        model: agent.model || MODEL,
        input,
        max_output_tokens: 800,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      console.error("[agents/chat] upstream", upstream.status, errText);
      await refundCredits({ userId, amount: COST, reason: REASON, ref: agent.slug });
      return NextResponse.json(
        { error: "Агент түр доголдов. Кредит буцаагдлаа." },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    // Prefer the convenience field; fall back to traversing output[0].content[].text
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      reply = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const block of data.output) {
        if (Array.isArray(block.content)) {
          for (const c of block.content) {
            if (c && typeof c.text === "string") parts.push(c.text);
          }
        }
      }
      reply = parts.join("").trim();
    }

    if (!reply) {
      await refundCredits({ userId, amount: COST, reason: REASON, ref: agent.slug });
      return NextResponse.json(
        { error: "Хариу хоосон. Кредит буцаагдлаа." },
        { status: 502 }
      );
    }
  } catch (e) {
    console.error("[agents/chat] error", e);
    await refundCredits({ userId, amount: COST, reason: REASON, ref: agent.slug });
    return NextResponse.json(
      { error: "Сүлжээний алдаа. Кредит буцаагдлаа." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    reply,
    credits: spend.balance,
    agent: agent.slug,
  });
}
