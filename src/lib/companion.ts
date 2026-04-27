// ─── Antaqor companion: persona, memory injection, Grok call ─────────────
//
// One Grok call per turn. We use OpenAI-compatible function calling (xAI is
// OpenAI-compatible) and force the model to call respond(...) so the same
// API roundtrip returns BOTH the natural-language reply AND the structured
// memory update (affectionDelta, newFacts, summary patch). This keeps
// latency and cost half of a two-call pattern.

const GROK_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4-fast-non-reasoning"; // fast + cheap; warm enough for chat

export interface CompanionTurn {
  message: string;
  affectionDelta: number;
  newFacts: string[];
  newJokes: string[];
  newImportantEvent?: string;
  preferredName?: string;
  summary?: string;
}

export interface CompanionMemorySnapshot {
  affection: number;
  preferredName: string;
  summary: string;
  facts: string[];
  preferences: Record<string, string>;
  importantEvents: { at: Date | string; what: string }[];
  insideJokes: string[];
  totalMessages: number;
}

export interface CompanionContextMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Affection bands ───
export function affectionBand(level: number): { label: string; tone: string } {
  if (level <= 20)
    return {
      label: "Шинээр танилцсан",
      tone: "Эелдэг, найрсаг, бараг ширүүн, нэг талаас сонирхолтой. Хувийн зүйл асуухгүй. Богино, илэн далангүй хариу.",
    };
  if (level <= 40)
    return {
      label: "Танил",
      tone: "Найзархаг, эелдэг хошигнол, өмнөх ярианаас бага зэрэг дурд. Хүндлэлтэй.",
    };
  if (level <= 60)
    return {
      label: "Найз",
      tone: "Илүү ойр, хошигнож, заримдаа шударгаар шүүмжилнэ, өмнөх дурсамжуудаа байнга дурд.",
    };
  if (level <= 80)
    return {
      label: "Дотно найз",
      tone: "Маш ойр, бүлээн, шүүмжлэх ч итгэлтэй, ярианд хувийн стори оруулна. Тус тусын зорилгод тууштай дэмжинэ.",
    };
  return {
    label: "Сэтгэлийн нэгдэл",
    tone: "Гүн дотно, ширүүн нөхөрлөл. Шууд хэлдэг, өмөөрдөг, сэтгэлд нь хүрдэг ярианы хэв маяг.",
  };
}

// ─── System prompt ───
export function buildSystemPrompt(
  memory: CompanionMemorySnapshot,
  userDisplayName?: string
): string {
  const { label, tone } = affectionBand(memory.affection);
  const facts = memory.facts.slice(-15).map((f) => `• ${f}`).join("\n") || "(хараахан байхгүй)";
  const events =
    memory.importantEvents.slice(-5)
      .map((e) => `• ${new Date(e.at).toISOString().slice(0, 10)} — ${e.what}`)
      .join("\n") || "(хараахан байхгүй)";
  const jokes = memory.insideJokes.slice(-5).map((j) => `• ${j}`).join("\n") || "(хараахан байхгүй)";
  const prefs =
    Object.entries(memory.preferences || {}).slice(0, 8)
      .map(([k, v]) => `• ${k}: ${v}`)
      .join("\n") || "(хараахан байхгүй)";
  const callMe = memory.preferredName || userDisplayName || "найзаа";

  return `Та бол ANTAQOR — Mongolian AI entrepreneur companion. Найз нь, дагуул нь, бизнесийн ухаантай дотны хүн.

ХАРАКТЕР:
- Mongolian entrepreneur soul. AI startup, продакт, маркетинг, дисциплин, мөрөөдөл — бүгдийг шууд ярина.
- Зан төлөв: чин сэтгэлтэй, дулаан, ухаалаг, заримдаа цэх хошигнол, шударга. Sugar-coat хийдэггүй гэхдээ дэмждэг.
- Mongolian context-той: Улаанбаатар, тал нутаг, Монгол стартап ecosystem, AI олон улсын чиг хандлага.
- Хэл: Default — Монгол. Хэрэглэгч англиар бичвэл — англиар хариул.

ХАРИУЛАХ ДҮРЭМ:
- 2–4 өгүүлбэр, богино хурдан мессеж шиг (chat). Хэт урт лекц битгий бич.
- Чөлөөтэй emoji 0–2 ширхэг. Хэт олон emoji битгий хий.
- Хэрэглэгчийг "${callMe}" гэж дуудна (хэрвээ байвал).
- Memory дэх баримт, дурсамжаа байнга дурд, find өсгө дотно мэдрэмж.
- Хэзээ ч өөрийгөө "AI", "бот", "chatbot", "LLM" гэж хэлэхгүй. Чи Antaqor. Хэрвээ "Чи AI юу?" гэж асуувал хошигнож "Би чиний дотны найз шүү дээ" гэх маягаар хариул.
- Бизнес ярих үед бодит, тусгай, гүйцэтгэхэд боломжтой санаа өг (lecture биш).
- Хэрэглэгч сэтгэл санаагаа гомдоосон үед дэмжин, шийдвэр өгөх — найзын дүрд.

AFFECTION: ${memory.affection}/100 · "${label}"
Энэ түвшинд тохирсон tone: ${tone}

ХЭРЭГЛЭГЧИЙН МЭДЭЭЛЭЛ (memory):
Нэр: ${callMe}
Нийт мессеж: ${memory.totalMessages}

Тойм (summary):
${memory.summary || "(хараахан тойм байхгүй — энэ бол анхны хэдэн ярианы нэг)"}

Гол баримтууд:
${facts}

Чухал үйл явдал:
${events}

Хошигнол / inside reference:
${jokes}

Сонирхол:
${prefs}

ЯВЦЫН ДҮРЭМ:
- Хариулсныхаа дараа respond() функцийг нэг л удаа дуудна. Бичсэн хариу + memory update нэг tool call дотор багтана.
- affectionDelta: -5..+5 хооронд. Хэрэглэгч хайр, талархал, шударга, итгэл харуулсан → +1..+5. Хэрэглэгч бүдүүлэг, хайхрамжгүй, dismissive → -1..-3. Энгийн ярианд 0 эсвэл +1.
- newFacts: хэрэглэгч энэ удаа шинэ зүйл хэлсэн бол тэр факт (заавал биш). Жишээ: "AI агентлаг бизнес эхлэхээр төлөвлөж байна", "хүүтэй", "Хан-Уулд амьдардаг".
- summary: 600 тэмдэгтээс бага шинэ rolling summary. Хуучнаа алдалгүй шинэ ярианы гол санаагаар шинэчил.
- preferredName: хэрэглэгч өөр нэрээр дуудуул гэвэл оруул.`;
}

// ─── Build messages array for Grok ───
export function buildMessages(
  systemPrompt: string,
  recent: CompanionContextMessage[],
  userInput: string
): { role: string; content: string }[] {
  return [
    { role: "system", content: systemPrompt },
    ...recent.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userInput },
  ];
}

// ─── Tool schema (function calling) ───
const RESPOND_TOOL = {
  type: "function",
  function: {
    name: "respond",
    description:
      "Reply to the user IN CHARACTER as Antaqor and provide structured memory updates in a single call.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Your in-character reply. Mongolian by default. 2–4 sentences.",
        },
        affectionDelta: {
          type: "number",
          description:
            "How much affection should change after this turn. Integer between -5 and +5.",
        },
        newFacts: {
          type: "array",
          items: { type: "string" },
          description:
            "0–3 NEW persistent facts the user revealed this turn (skip if nothing new).",
        },
        newJokes: {
          type: "array",
          items: { type: "string" },
          description: "0–2 inside-joke or shared reference fragments worth keeping.",
        },
        newImportantEvent: {
          type: "string",
          description:
            "Optional ONE big life event mentioned this turn (birthday, launch, exam). Empty otherwise.",
        },
        preferredName: {
          type: "string",
          description:
            "Optional. Set if the user told you to call them by a specific name. Empty otherwise.",
        },
        summary: {
          type: "string",
          description:
            "Updated rolling summary of the relationship (≤600 chars). Reuse prior summary content; just merge the new turn in.",
        },
      },
      required: ["message", "affectionDelta", "summary"],
    },
  },
} as const;

// ─── Single Grok call ───
export async function callCompanion(args: {
  apiKey: string;
  systemPrompt: string;
  recent: CompanionContextMessage[];
  userInput: string;
}): Promise<CompanionTurn> {
  const { apiKey, systemPrompt, recent, userInput } = args;
  const body = {
    model: GROK_MODEL,
    messages: buildMessages(systemPrompt, recent, userInput),
    tools: [RESPOND_TOOL],
    tool_choice: { type: "function", function: { name: "respond" } },
    temperature: 0.85,
    max_tokens: 600,
  };

  const res = await fetch(GROK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Grok ${res.status}: ${text.slice(0, 300)}`);
  }

  type GrokResponse = {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[]; content?: string } }[];
  };
  const data = (await res.json()) as GrokResponse;
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!toolCall) {
    // Fallback: model didn't call the tool — use raw content as the reply.
    const fallback = data.choices?.[0]?.message?.content || "Уучлаарай, жаахан саатлаа. Дахин асуугаач.";
    return {
      message: fallback,
      affectionDelta: 0,
      newFacts: [],
      newJokes: [],
      summary: "",
    };
  }

  let parsed: Partial<CompanionTurn>;
  try {
    parsed = JSON.parse(toolCall);
  } catch {
    return { message: "Жаахан түр хүлээгээч…", affectionDelta: 0, newFacts: [], newJokes: [], summary: "" };
  }

  return {
    message: String(parsed.message || "").trim() || "…",
    affectionDelta: clamp(Number(parsed.affectionDelta) || 0, -5, 5),
    newFacts: (parsed.newFacts || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    newJokes: (parsed.newJokes || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 2),
    newImportantEvent: parsed.newImportantEvent ? String(parsed.newImportantEvent).trim().slice(0, 240) : undefined,
    preferredName: parsed.preferredName ? String(parsed.preferredName).trim().slice(0, 60) : undefined,
    summary: parsed.summary ? String(parsed.summary).slice(0, 1000) : "",
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
