// AI-driven conversational agent for dynamic funnels.
// Instead of asking a fixed list of questions, the agent decides the NEXT
// best question (or whether to finalize) based on what's already known and
// what the user just said. Backed by Grok with structured JSON output.

export interface DynamicAgentSpec {
  name: string;
  // Persona / role for the agent (e.g. "найзшиг танилцаж буй founder")
  agentSystemPrompt: string;
  // Facts the agent should try to gather. Used as a hint, not a hard schema.
  factsToGather: string[];
  // Hard cap on number of questions to avoid runaway conversations.
  maxTurns: number;
}

export interface DynamicStep {
  // Inputs
  history: Array<{ role: "assistant" | "user"; content: string }>;
  facts: Record<string, string>;
  questionsAsked: number;
}

export interface DynamicResult {
  action: "ask" | "done";
  question?: string;
  options?: string[];
  facts: Record<string, string>;
  reasoning?: string;
}

const FENCE_RE = /```(?:json)?\s*([\s\S]*?)```/i;

export async function nextDynamicMove(
  spec: DynamicAgentSpec,
  state: DynamicStep
): Promise<DynamicResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY missing");

  // Hard-stop at max turns: force finalize without another Grok roundtrip.
  if (state.questionsAsked >= spec.maxTurns) {
    return { action: "done", facts: state.facts };
  }

  const factsHint = spec.factsToGather.length
    ? `\n\nIdeally gather these facts (don't ask robotically — let them emerge naturally):\n${spec.factsToGather.map((f) => `• ${f}`).join("\n")}`
    : "";

  const sys = `${spec.agentSystemPrompt}${factsHint}

# Tone
Богино. Playful. Entrepreneur өнгө, хошин шог зөөлөн. Найз шиг — corporate биш.
Асуулт = 1 өгүүлбэр, ихдээ 12 үг. Max 1 emoji. Mongol хэлээр.
Хүнд биш, хөнгөн, "andaa" vibe. Жишээ: "За тэгээд — юунд хамгийн их цаг зарцуулдаг вэ? 😄"

# Output rules
Турбүр ASK эсвэл DONE гэж шийд.
ASK — role, goal, гол хэрэгцээ нь тодорхойгүй бол.
DONE — useful зөвлөгөө өгөхөд хангалттай мэдсэн бол. Нийт ${Math.min(3, spec.maxTurns)}–${spec.maxTurns} асуулт.
Боломжтой бол options өг — хэрэглэгч бичихгүй, товч дараад л явна (хурдан + playful).

Зөвхөн JSON буцаа — markdown ч үгүй, тайлбар ч үгүй, code fence ч үгүй:
{
  "action": "ask" | "done",
  "question": "<дараагийн асуулт, action=ask үед. Богино, playful, өмнөх хариу дээр build хий. Битгий давт.>",
  "options": ["<2-4 богино tap хариулт, тус бүр ≤18 тэмдэгт>"],  // OPTIONAL — зөвхөн асуултад тодорхой сонголтууд байвал. Чөлөөт хариу шаардвал [] орхи.
  "facts": { "<key>": "<value>" }   // одоо хүртэл мэдэх БҮХ facts (өмнөх + шинэ нийлүүл). snake_case key. Зөрчилдөхгүй бол юу ч бүү хая.
}`;

  const knownFactsBlock = Object.keys(state.facts).length
    ? `Known facts so far:\n${JSON.stringify(state.facts, null, 2)}`
    : `No facts gathered yet.`;

  const transcript = state.history
    .map((h) => `${h.role.toUpperCase()}: ${h.content}`)
    .join("\n");

  const user = `${knownFactsBlock}

Conversation so far:
${transcript || "(none yet — this is the first turn)"}

What's the next move? JSON only.`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_AGENT_MODEL || "grok-3-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        max_tokens: 500,
        temperature: 0.5,
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
    const raw = data.choices?.[0]?.message?.content?.trim() || "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Grok occasionally wraps JSON in fences or trailing commentary.
      const fenced = raw.match(FENCE_RE)?.[1] || raw.match(/\{[\s\S]*\}/)?.[0] || "";
      if (!fenced) throw new Error("dynamic agent: non-JSON response");
      parsed = JSON.parse(fenced);
    }

    const p = parsed as {
      action?: string;
      question?: string;
      options?: unknown;
      facts?: Record<string, string>;
    };

    const action = p.action === "done" ? "done" : "ask";
    const facts = (p.facts && typeof p.facts === "object") ? p.facts : state.facts;

    if (action === "done") {
      return { action: "done", facts };
    }
    const question = (p.question || "").trim();
    if (!question) {
      // Malformed ASK without question → finalize defensively.
      return { action: "done", facts };
    }
    const options = Array.isArray(p.options)
      ? p.options
          .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
          .slice(0, 4)
          .map((o) => o.trim().slice(0, 20))
      : undefined;
    return { action: "ask", question, options, facts };
  } finally {
    clearTimeout(timer);
  }
}
