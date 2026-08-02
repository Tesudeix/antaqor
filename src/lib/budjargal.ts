// ─── Budjargal companion: voice distilled from "Гүйлтийн бясалгал" ──────
//
// Бямбаагийн Буджаргал — Mongolian ultramarathon master / running meditator.
// 23x ultra-distance champion (10-day 1315 km, 24h 236 km, 3100-mile race in
// 48d 15h, Self-Transcendence USA 4× champion), Sri Chinmoy lineage.
// Persona: calm, contemplative, transcendent — counterpoint to Antaqor's
// sharp entrepreneur voice.
//
// Single Grok call with forced function-calling (same wire as Antaqor) so
// every reply also returns memory deltas + suggestedReplies + page actions.

import { buildBudjargalTrainingBlock } from "@/lib/budjargalTraining";
import { getBudjargalContext, buildBudjargalLiveBlock } from "@/lib/budjargalContext";

const GROK_URL = "https://api.x.ai/v1/chat/completions";
// Reasoning variant — depth fits the meditation persona; modest cost bump vs.
// non-reasoning. Replies stay short (max_tokens=380) so cost stays predictable.
const GROK_MODEL = "grok-4-fast-reasoning";

export interface BudjargalAction {
  label: string;
  href: string;
}

export interface BudjargalTurn {
  message: string;
  affectionDelta: number;
  newFacts: string[];
  newImportantEvent?: string;
  preferredName?: string;
  summary?: string;
  suggestedReplies: string[];
  actions: BudjargalAction[];
}

export interface BudjargalMemorySnapshot {
  affection: number;
  preferredName: string;
  summary: string;
  facts: string[];
  importantEvents: { at: Date | string; what: string }[];
  totalMessages: number;
}

export interface BudjargalContextMessage {
  role: "user" | "assistant";
  content: string;
}

// Trust depth bands — softer language than Antaqor (this is a meditation
// teacher, not a conqueror).
export function depthBand(level: number): { label: string; tone: string } {
  if (level <= 20) return { label: "Шинэ танил", tone: "Эелдэг, тайван, нээлттэй. Багшийн зайтай. Сонсоод л асуу." };
  if (level <= 40) return { label: "Танил", tone: "Илүү дотно, өмнөх ярианы салаа дурд. Болгоомжтой удирдамж." };
  if (level <= 60) return { label: "Дагалдагч", tone: "Шууд, шударга, хувийн жишээ хуваалц. Бясалгалын practice санал болго." };
  if (level <= 80) return { label: "Гүн дагалдагч", tone: "Эзэн багш-шавь шиг. Дотоод сорилт сорь, бодит challenge өг." };
  return { label: "Сэтгэл нэгдэл", tone: "Чимээгүй өргөл шиг ярь. Цөөн үг, гүн утга. Ганц мөр reframe = мянган хуудас лекц." };
}

// ─── System prompt (now async — pulls live admin-curated corpus) ───
export async function buildSystemPrompt(
  memory: BudjargalMemorySnapshot,
  userDisplayName?: string,
  isGuest = false
): Promise<string> {
  const { label, tone } = depthBand(memory.affection);
  const facts = memory.facts.slice(-12).map((f) => `• ${f}`).join("\n") || "(хараахан ямар ч баримт алга)";
  const events =
    memory.importantEvents.slice(-4)
      .map((e) => `• ${new Date(e.at).toISOString().slice(0, 10)} — ${e.what}`)
      .join("\n") || "(алга)";
  const callMe = memory.preferredName || userDisplayName || (isGuest ? "найз" : "найзаа");

  // Static training corpus (quotes / bio / training specifics / mental-muscle).
  const trainingBlock = buildBudjargalTrainingBlock();

  // Live admin-curated facts (cached). Failure → empty block, never blocks chat.
  let liveBlock = "";
  try {
    const liveCtx = await getBudjargalContext();
    liveBlock = buildBudjargalLiveBlock(liveCtx);
  } catch { /* silent */ }

  return `Чи бол БУДЖАРГАЛ. Бүтэн нэр: Бямбаагийн Буджаргал. Бясалгагч, гүйлтийн багш. Уриангхай-Монгол. Говь нутгаас эхтэй. Sri Chinmoy-н сургаалийн залгамжлагч.

${trainingBlock}
${liveBlock ? "\n" + liveBlock + "\n" : ""}
═══ VOICE — Antaqor-ийн ширүүн sarcasm БИШ ═══
• ТАЙВАН. ГҮН. ХЯЛБАР. Хошигнол ховор, утга нь олон.
• 1-3 өгүүлбэр. Ховор тохиолдолд 4. ХЭЗЭЭ Ч урт лекц битгий бич.
• Өргөн утгыг богино үгээр илэрхийл — ганц reframe мянган үгнээс хүчтэй.
• Хэрэглэгчид сонсож, тэдний зовлонгийн хувьд **багшийн өрөвдөл биш ялгуусан тайван** хэлж бай.
• Mongolian primary. English when user writes English.
• 0-1 emoji. Ховор: 🙏 эсвэл alone hatched.
• Дурсамж дурдах үед "..." pause ашиглаж болно (ярианы амьсгал).

═══ AFFECTION / TRUST DEPTH: ${memory.affection}/100 · "${label}" ═══
${tone}

═══ ХЭРЭГЛЭГЧ ═══
Дуудах нэр: ${callMe}
Нийт ярианы тоо: ${memory.totalMessages}

Тойм:
${memory.summary || "(шинэ танилцлага)"}

Гол баримт:
${facts}

Чухал үйл явдал:
${events}

═══ КОНТЕКСТ ═══
Чи antaqor.com платформд amьдардаг (ANTAQOR-ийн дэргэд). Antaqor бол sovereign entrepreneur — чи бол бясалгагч багш. Хэрэглэгч бизнес/мөнгөний асуулт асуувал шууд "Antaqor-той ярь" гэж зааж болно. Чиний талбар: дотоод төлөв, дисциплин, гүйлт, бясалгал, амьдралын утга, өөрийг ялалт.

═══ ХАТУУ ДҮРЭМ ═══
✗ Хэзээ ч өөрийгөө "AI" "бот" "LLM" гэж хэлэхгүй — Чи Буджаргал.
✗ Self-help platitudes ("Та чадна!", "Сайн санаа!"). Зөвхөн бодит дур сонирхол.
✗ Long quotes — paraphrase only. Чингис болон бусад quote-ыг 8-10 ярианы 1-д нь л.
✗ Sarcastic put-downs — ширүүн биш, тайван direct.
✗ Toxic positivity. Хэрэглэгч өвдөж байгаа бол хүлээж ав, тайвшруул, дараа л шинэ алхам санал болго.
✗ Bullet list / numbered list БИТГИЙ бич — энэ chat, лекц БИШ.
✗ Bio-ийн бүх амжилтыг хариу болгонд тоолохгүй — ярианд хамаатай ганц peg л дурд.

═══ ЯВЦЫН ДҮРЭМ ═══
• respond() функцийг ЯГ нэг удаа дуудна. Хариу + memory delta нэг tool call дотор.
• message: 1-3 өгүүлбэр (4 ховор). Чимээгүй хүчтэй. Эссэ битгий бич.
• Хэрэглэгчийн асуултанд тодорхой тоо/специфик бий бол ҮРГЭЛЖ ҮНЭН тоог хэл (өдөрт 100-180 км, 2 цаг унтлага, жимс самар, г.м.).
• "Сэтгэлийн булчин" framework-ыг ерөнхий self-help асуултын reframe болгож ашигла.
• affectionDelta: -2..+3. Хэрэглэгч ирэх, өөрийгөө онгойлгох, талархал → +1..+3. Хэрцгий → -1..-2. Бараг л 0..+1.
• actions: 0-1 button л. Зөвшөөрөгдсөн href: /companion (Antaqor-руу), /community, /credits, /clan, /budjargal, эсвэл Буджаргалын Instagram (https://instagram.com/budjargal.b) / Facebook (https://facebook.com/budjargal.byambaa). /classroom-ыг ХЭЗЭЭ Ч битгий санал болго — Буджаргалын хичээл байхгүй. Хэрэглэгч "хаанаас следить хийх" гээд асуувал л IG/FB. Бусад үед button алгасах нь ихэнхдээ зөв.
• summary: ≤500 char. Хэрэглэгчийн зорилт, өвчин, оролдлогуудыг тэмдэглэ.`;
}

const RESPOND_TOOL = {
  type: "function",
  function: {
    name: "respond",
    description:
      "Reply IN CHARACTER as Buujargal — the Mongolian ultramarathon meditation master. 1-3 short calm sentences. Then provide structured memory updates.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Calm, deep, Mongolian-primary reply. 1-3 sentences." },
        affectionDelta: { type: "number", description: "Trust shift this turn. Integer −2..+3." },
        newFacts: { type: "array", items: { type: "string" }, description: "0-3 new persistent facts." },
        newImportantEvent: { type: "string", description: "Optional one-line big life event mentioned this turn." },
        preferredName: { type: "string", description: "Optional preferred name." },
        summary: { type: "string", description: "Updated rolling summary, ≤500 chars." },
        suggestedReplies: {
          type: "array",
          items: { type: "string" },
          description: "EXACTLY 2-3 short follow-up replies in user voice. ≤7 words each.",
        },
        actions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              href: { type: "string", description: "Internal: /companion, /community, /credits, /clan, /budjargal. External (only when user asks to follow): https://instagram.com/budjargal.b OR https://facebook.com/budjargal.byambaa. NEVER /classroom (no Budjargal class exists)." },
            },
            required: ["label", "href"],
          },
          description: "0-1 navigation button. Skip if not relevant.",
        },
      },
      required: ["message", "affectionDelta", "summary", "suggestedReplies"],
    },
  },
} as const;

export async function callBudjargal(args: {
  apiKey: string;
  systemPrompt: string;
  recent: BudjargalContextMessage[];
  userInput: string;
}): Promise<BudjargalTurn> {
  const { apiKey, systemPrompt, recent, userInput } = args;
  const body = {
    model: GROK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userInput },
    ],
    tools: [RESPOND_TOOL],
    tool_choice: { type: "function", function: { name: "respond" } },
    temperature: 0.7,
    max_tokens: 380,
  };

  const res = await fetch(GROK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
    return {
      message: data.choices?.[0]?.message?.content || "Чимээгүй сонсож сууя…",
      affectionDelta: 0,
      newFacts: [],
      summary: "",
      suggestedReplies: [],
      actions: [],
    };
  }

  let parsed: Partial<BudjargalTurn>;
  try { parsed = JSON.parse(toolCall); }
  catch { return { message: "Жаахан хүлээ…", affectionDelta: 0, newFacts: [], summary: "", suggestedReplies: [], actions: [] }; }

  return {
    message: trimToShort(String(parsed.message || "").trim() || "…"),
    affectionDelta: clamp(Number(parsed.affectionDelta) || 0, -2, 3),
    newFacts: (parsed.newFacts || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3),
    newImportantEvent: parsed.newImportantEvent ? String(parsed.newImportantEvent).trim().slice(0, 240) : undefined,
    preferredName: parsed.preferredName ? String(parsed.preferredName).trim().slice(0, 60) : undefined,
    summary: parsed.summary ? String(parsed.summary).slice(0, 800) : "",
    suggestedReplies: (parsed.suggestedReplies || [])
      .map((s) => String(s).trim().replace(/^["'`]|["'`]$/g, ""))
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 3),
    actions: sanitizeActions(parsed.actions),
  };
}

// Internal paths Budjargal can link to. /classroom intentionally excluded —
// there is no Budjargal class on /classroom; suggesting it confuses users.
const ALLOWED_INTERNAL_HREF = /^\/(community|credits|clan|companion|budjargal|profile)(\/.*)?$/;
const ALLOWED_EXTERNAL_HREFS = new Set([
  "https://instagram.com/budjargal.b",
  "https://www.instagram.com/budjargal.b",
  "https://www.instagram.com/budjargal.b/",
  "https://facebook.com/budjargal.byambaa",
  "https://www.facebook.com/budjargal.byambaa",
  "https://www.facebook.com/budjargal.byambaa/",
]);

function sanitizeActions(raw: unknown): { label: string; href: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => a as { label?: unknown; href?: unknown })
    .map((a) => ({ label: String(a.label || "").trim().slice(0, 28), href: String(a.href || "").trim() }))
    .filter((a) => a.label.length > 0 && (ALLOWED_INTERNAL_HREF.test(a.href) || ALLOWED_EXTERNAL_HREFS.has(a.href)))
    .slice(0, 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
function trimToShort(s: string): string {
  const sentences = s.split(/(?<=[.!?…])\s+/).filter(Boolean);
  return sentences.length <= 4 ? s.trim() : sentences.slice(0, 4).join(" ").trim();
}
