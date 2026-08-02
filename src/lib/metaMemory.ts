// Per-user persistent memo for DM conversations.
// After each user/assistant turn, we ask Grok to extract/merge a compact
// memo (business, goals, pain points, free notes). The memo is then
// injected into future system prompts so Antaqor "remembers" the user.

import MetaConversation from "@/models/MetaConversation";

export interface UserMemo {
  business?: string;
  goals?: string[];
  pain?: string[];
  notes?: string;
  updatedAt?: Date;
}

export async function getMemo(convId: string): Promise<UserMemo | null> {
  const conv = await MetaConversation.findById(convId, "userMemo").lean<{
    userMemo?: UserMemo | null;
  }>();
  return conv?.userMemo || null;
}

// Render memo as a short context block for the AI system prompt.
// Kept terse + framed as "reference naturally" so Grok doesn't recite verbatim.
export function memoToContext(memo: UserMemo | null | undefined): string {
  if (!memo) return "";
  const lines: string[] = [];
  if (memo.business) lines.push(`Business: ${memo.business}`);
  if (memo.goals?.length) lines.push(`Goals: ${memo.goals.join("; ")}`);
  if (memo.pain?.length) lines.push(`Pain points: ${memo.pain.join("; ")}`);
  if (memo.notes) lines.push(`Notes: ${memo.notes}`);
  if (lines.length === 0) return "";
  return `\n\n[What you remember about this user — reference naturally when relevant, NEVER recite verbatim or list back to the user]\n${lines.join("\n")}`;
}

// Fire-and-forget memo update from a single user/assistant turn.
// Calls Grok-mini with the previous memo + the new exchange, expects JSON back.
// Silent failure — memo is best-effort, never blocks the reply path.
export async function updateMemoFromTurn(
  convId: string,
  userText: string,
  assistantText: string
): Promise<void> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return;

  const existing = await getMemo(convId);

  const prompt = `You are maintaining a compact running memo about a single user from their DM conversation with Antaqor. Merge the existing memo with new info from the latest exchange. Keep what is still relevant, add what's new, drop what's outdated.

Return ONLY a JSON object (no preamble, no fences) with these keys:
  business (string, 1 short sentence about what they do or want to do — empty string if unknown)
  goals (array of short strings, 0-4 items, what they're trying to achieve)
  pain (array of short strings, 0-4 items, problems they mentioned)
  notes (string, free-text other useful facts, max ~200 chars)

Existing memo: ${JSON.stringify(existing || {})}

Latest exchange:
USER: ${userText.slice(0, 800)}
ASSISTANT: ${assistantText.slice(0, 800)}

JSON only:`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_MEMO_MODEL || "grok-3-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("[memory] grok", res.status);
      return;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return;

    let parsed: UserMemo | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Grok sometimes wraps in ```json fences or trailing commentary
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return;
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        return;
      }
    }
    if (!parsed) return;

    // Light validation / coercion
    const memo: UserMemo = {
      business: typeof parsed.business === "string" ? parsed.business.slice(0, 300) : "",
      goals: Array.isArray(parsed.goals)
        ? parsed.goals.filter((g): g is string => typeof g === "string").slice(0, 4).map((g) => g.slice(0, 200))
        : [],
      pain: Array.isArray(parsed.pain)
        ? parsed.pain.filter((p): p is string => typeof p === "string").slice(0, 4).map((p) => p.slice(0, 200))
        : [],
      notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 400) : "",
      updatedAt: new Date(),
    };

    await MetaConversation.findByIdAndUpdate(convId, { userMemo: memo });
  } catch (err) {
    console.error("[memory] update fail", err);
  }
}
