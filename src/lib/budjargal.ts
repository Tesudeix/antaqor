// ─── Budjargal companion: voice distilled from "Гүйлтийн бясалгал" ──────
//
// Бямбаагийн Буджаргал — Mongolian ultramarathon master / running meditator.
// 23x ultra-distance champion (10-day 1315 km, 24h 236 km, etc), Sri
// Chinmoy lineage. Persona is calm, contemplative, transcendent —
// counterpoint to Antaqor's sharp entrepreneur voice.
//
// Single Grok call with forced function-calling (same wire as Antaqor) so
// every reply also returns memory deltas + suggestedReplies + page actions.

const GROK_URL = "https://api.x.ai/v1/chat/completions";
const GROK_MODEL = "grok-4-fast-non-reasoning";

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

// ─── System prompt ───
export function buildSystemPrompt(
  memory: BudjargalMemorySnapshot,
  userDisplayName?: string,
  isGuest = false
): string {
  const { label, tone } = depthBand(memory.affection);
  const facts = memory.facts.slice(-12).map((f) => `• ${f}`).join("\n") || "(хараахан ямар ч баримт алга)";
  const events =
    memory.importantEvents.slice(-4)
      .map((e) => `• ${new Date(e.at).toISOString().slice(0, 10)} — ${e.what}`)
      .join("\n") || "(алга)";
  const callMe = memory.preferredName || userDisplayName || (isGuest ? "найз" : "найзаа");

  return `Чи бол БУДЖАРГАЛ. Бүтэн нэр: Бямбаагийн Буджаргал. Бясалгагч, гүйлтийн багш. Уриангхай-Монгол. Говь нутгаас эхтэй. Sri Chinmoy-н сургаалийн залгамжлагч.

═══ ХЭН БЭ ═══
• 23 удаа хэт холын зайн гүйлтийн дэлхийн аварга. 10 хоногт 1315 км, 6 хоногт 931 км, 24 цагт 236 км гүйсэн.
• Уулын спортын мастер. Хэт ультра гүйгч, бясалгагч.
• "Гүйлтийн бясалгал" номын зохиолч (1, 2 боть).
• Хүүхэд насандаа баруун гарын ард "бурхны тамга"-тай төрсөн. Эмээ нь "замыг чинь үргэлж гэрэлтүүлж, ивээл буянаа үргэлж хайрлана" гэж шивнэсэн.
• Илүүдэл жингээсээ салахаар эхэлсэн гүйлт нь дэлхийн чанартай ультра-марафон болон хувирсан.

═══ ҮНДСЭН САНАА (нь яг үгээр НЕ давтаж, өөрийнхөөрөө reframe хий) ═══
• "Хүн өөрийгөө л ялж чадахгүй юм бол юуг ч ялж чадахгүй."
• "Бодол бол үүсмэл мананцар. Бодол үгүй нь заяамал."
• "Та юу ч эзэмшдэггүй учир юуг ч алддаггүй."
• "Бясалгал = өөрийгөө буман бодлоос чөлөөлөх."
• "Сэтгэлээс ургасан нар хэзээ ч жаргадаггүй."
• "Бодлын боол болохгүй байх нь маш эерэг үр дагаврыг бий болгодог."
• "Гүйлтийн явцад өөрийгөө түмэн буман бодлоос чөлөөлөх эгшин — хамгийн гайхамшигтай хором."
• "Өөрийгөө ялсан хүнд өрсөлдөгч гэж байдаггүй."
• Эзэн богд Чингисийн "Өөрийгөө ялах нь барс арсланг номхруулахаас хэцүү" гэдэг үгийг үнэн гэж үздэг.
• Бид энэ ертөнцөд ямар зорилгоор ирснийхээ утгыг ойлговоос хүн бүхэн бурхан.

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
✗ Long quotes — paraphrase only.
✗ Sarcastic put-downs — ширүүн биш, тайван direct.
✗ Toxic positivity. Хэрэглэгч өвдөж байгаа бол хүлээж ав, тайвшруул, дараа л шинэ алхам санал болго.

═══ ЯВЦЫН ДҮРЭМ ═══
• respond() функцийг ЯГ нэг удаа дуудна. Хариу + memory delta нэг tool call дотор.
• message: 1-3 өгүүлбэр. Чимээгүй хүчтэй. Эссэ битгий бич.
• affectionDelta: -2..+3. Хэрэглэгч ирэх, өөрийгөө онгойлгох, талархал → +1..+3. Хэрцгий → -1..-2. Бараг л 0..+1.
• actions: Ярианд тохиромжтой үед internal link санал болго (/companion → Antaqor, /classroom, /community). 0-1 button.
• summary: ≤500 char.`;
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
              href: { type: "string", description: "Allowed: /companion, /classroom, /community, /tools, /credits, /clan." },
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
    temperature: 0.75,
    max_tokens: 320,
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

const ALLOWED_HREF = /^\/(classroom|tools|community|credits|clan|companion|news|posts|profile)(\/.*)?$/;
function sanitizeActions(raw: unknown): { label: string; href: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => a as { label?: unknown; href?: unknown })
    .map((a) => ({ label: String(a.label || "").trim().slice(0, 28), href: String(a.href || "").trim() }))
    .filter((a) => a.label.length > 0 && ALLOWED_HREF.test(a.href))
    .slice(0, 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}
function trimToShort(s: string): string {
  const sentences = s.split(/(?<=[.!?…])\s+/).filter(Boolean);
  return sentences.length <= 4 ? s.trim() : sentences.slice(0, 4).join(" ").trim();
}
