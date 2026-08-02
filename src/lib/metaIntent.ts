// Lead intent scoring — single fast LLM call to classify each incoming DM.
// Returns score 0-10 and label (hot|warm|cold|support|fan|unknown).

export type IntentLabel = "hot" | "warm" | "cold" | "support" | "fan" | "unknown";

export interface IntentResult {
  score: number;
  label: IntentLabel;
}

const SYSTEM = `You are an intent classifier. Read the user message and return ONLY a JSON object:
{"score": <0-10>, "label": "<one of: hot,warm,cold,support,fan>"}

Rubric:
- hot (8-10): explicit buying signal — asks pricing, "how to subscribe", "send me payment link", urgency words
- warm (5-7): considering — "tell me more", "what's included", comparison questions
- cold (3-4): exploring — generic questions, just chatting
- support (varies): existing customer with issue — login problem, refund, technical
- fan (1-3): praise, emoji-only, "you're great", no intent to buy

Return JSON only, no markdown, no explanation.`;

export async function scoreIntent(text: string): Promise<IntentResult> {
  // Cheap provider preference: Grok mini (already configured)
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return fallbackScore(text);

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text.slice(0, 600) },
        ],
        max_tokens: 40,
        temperature: 0,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return fallbackScore(text);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return fallbackScore(text);
    const parsed = JSON.parse(m[0]) as { score?: number; label?: string };
    return {
      score: clamp(Number(parsed.score) || 0, 0, 10),
      label: normalizeLabel(parsed.label),
    };
  } catch {
    return fallbackScore(text);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function normalizeLabel(s?: string): IntentLabel {
  const v = (s || "").toLowerCase().trim() as IntentLabel;
  if (["hot", "warm", "cold", "support", "fan"].includes(v)) return v;
  return "unknown";
}

// Keyword-based fallback if LLM unavailable.
function fallbackScore(text: string): IntentResult {
  const t = text.toLowerCase();
  const hotKw = [
    "pricing", "price", "buy", "purchase", "subscribe", "pay", "payment",
    "үнэ", "хэдэн төгрөг", "төлөх", "захиалах", "захиалга",
  ];
  const supportKw = [
    "refund", "broken", "error", "doesn't work", "не работает", "буцаах",
    "ажиллахгүй", "алдаа",
  ];
  const fanKw = ["love", "amazing", "❤️", "❤", "🔥", "🚀", "👏"];

  if (hotKw.some((k) => t.includes(k))) return { score: 9, label: "hot" };
  if (supportKw.some((k) => t.includes(k))) return { score: 5, label: "support" };
  if (fanKw.some((k) => t.includes(k)) && t.length < 30) return { score: 2, label: "fan" };
  if (t.length < 15) return { score: 3, label: "cold" };
  return { score: 4, label: "cold" };
}
