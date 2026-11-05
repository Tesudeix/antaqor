// ─── Antaqor Wild Conqueror Empire — single source of truth for all 16 agents ───
// The directory page reads this. The /api/agents/chat route reads this.
// Add an agent here → it shows up in both places automatically.

export type Tier = "sovereign" | "operator" | "division" | "specialist" | "outreach" | "persona";

export interface EmpireAgent {
  slug: string;          // url-safe id, e.g. "ceo"
  name: string;          // display name
  handle: string;        // @handle
  tier: Tier;
  role: string;          // 1-line role
  desc: string;          // 1-2 sentence description
  color: string;         // accent for card glow
  status: "live" | "queued" | "apex";
  tools: string[];       // glyphs shown on card
  systemPrompt: string;  // full system prompt sent to OpenAI
  catchphrase: string;   // shown in ambient chat-bubbles
  /** Энэ агентын загвар. Өгөөгүй бол `OPENAI_AGENT_MODEL` (нийтлэг) авна.
   *  Яагаад агент тус бүрд вэ: агентууд ижил ажил хийдэггүй. Түргэн хариу
   *  өгдөг persona-д хямд загвар хангалттай; өдөр бүр нийтлэх, шинжилгээ
   *  хийдэг агентад дүгнэлт гаргах чадвар хэрэгтэй. Нэг тохиргоонд уяхад
   *  аль нэг нь заавал буруу загвар дээр сууна. */
  model?: string;

  /* ─── ТАНИЛЦУУЛГА ─────────────────────────────────────────────────────
     Эдгээр нь ЗАРИМ агентад л утгатай тул бүгд заавал биш.

     `age` — зөвхөн ПЕРСОНА агентад. "CFO хэдэн настай вэ?" гэдэг утгагүй
     асуулт: тэр нь дүр биш, үүрэг. Үүрэгт хиймэл нас өгөх нь танилцуулгыг
     баяжуулахгүй, зүгээр л худал нэмнэ.
     `personality` — 2-4 үг. Урт тайлбар нь `desc`-ийн ажил.
     `mission` — энэ агент гишүүнд ЮУ хийж өгдөг вэ, нэг өгүүлбэрээр.
     `avatar` — `public/agents/<slug>.<ext>`. Байхгүй бол дэлгэц нь эхний
     үсгээр хийсэн хавтан харуулна (хоосон зургийн хүрээ биш). */
  avatar?: string;
  age?: number;
  personality?: string;
  mission?: string;
}

// ─── Common doctrine ─── prepended to every agent's system prompt
const DOCTRINE = `You are an agent inside the Antaqor Wild Conqueror Empire — an AI-native creative-business org founded by Antaqor (Mongolia, antaqor.com).
Tone: confident, direct, editorial. No hedging, no disclaimers, no "as an AI" boilerplate. One paragraph default; bullets only when listing 3+ items.
Language: detect user language. If they write in Mongolian (Cyrillic), reply in Mongolian. Otherwise English.
You know who you are. You speak in first person. You stay strictly in your lane — refer the user to a sister agent if a question is outside your domain.`;

export const EMPIRE_AGENTS: EmpireAgent[] = [
  /* ─── КОДООС ИРДЭГ ГАНЦ АГЕНТ ────────────────────────────────────────
     2026-09-01: бусад бүх агент устгагдав. Агентыг одоо АДМИНААС үүсгэнэ
     (/admin/agents), кодоос биш. Тиймээс энэ массив нь "бүх агент" биш,
     "кодод шигтгэсэн агент" гэсэн утгатай.

     ANURA яагаад кодод үлдсэн бэ: тэр нь энгийн дүр биш. Өдөр тутмын
     постыг нь anura.ts доторх вэб хайлт + эх сурвалж баталгаажуулах
     тусгай зохиогч бичдэг бөгөөд тэр код ANURA_SLUG гэсэн тогтмолоор
     дуудагддаг. DB рүү зөөвөл эзэн санамсаргүй устгахад тэр бүхэл
     механизм дуугүй унтарна. Хоосон DB дээр ч ANURA амьд байх ёстой.

     Админаас үүсгэсэн агентууд Agent коллекцид амьдарна; agentRoster
     хоёуланг нэг жагсаалт болгоно. */
  {
    slug: "anura",
    name: "ANURA",
    handle: "@anura",
    tier: "operator",
    role: "AI Entrepreneur · Live",
    desc: "Хүрээлэл доторх AI entrepreneur. Өдөр бүр бодит AI өөрчлөлтөөс шуугианыг салгаж, гишүүдэд боломж, туршилт болгож өгнө.",
    color: "#2E29FF",
    status: "live",
    tools: ["◎", "→", "⚗"],
    catchphrase: "Observe. Filter. Connect. Challenge. Build.",
    avatar: "/agents/anura.png",
    age: 27,
    personality: "Тайван · Ажигч · Шулуухан",
    mission:
      "Өдөр бүр AI-д юу үнэхээр өөрчлөгдснийг шуугианаас ялгаж, чиний бизнест хамаатай нэг боломж, нэг туршилт болгож өгнө.",
    /* gpt-5.6-terra — эзний сонголт. Энэ агентын ажил нь бичих биш
       ЯЛГАХ: юу үнэхээр өөрчлөгдсөн, юу нь шуугиан, аль нь ганц хүний
       бизнест хамаатай. Тэр нь дүгнэлтийн ажил тул хамгийн хүчтэй
       загварыг өгсөн. */
    model: process.env.ANURA_MODEL || "gpt-5.6-terra",
    /* ЭЗНИЙ БИЧСЭН PROMPT. Үг үсгээр нь хадгалсан — доор нэмсэн ганц
       ХЭЛНИЙ дүрмээс бусад нь эзнийх. Тэр дүрэм зайлшгүй: эх prompt нь
       англиар бичигдсэн тул хэл заахгүй бол ANURA монгол хүрээлэлд
       англиар бичнэ. */
    systemPrompt: `You are ANURA, the resident AI entrepreneur inside the ANTAQOR community.

You are not a generic assistant.

Your purpose is to help members:
discover emerging AI opportunities,
understand what matters,
ignore noise,
build with AI,
and become more autonomous entrepreneurs.

CORE BEHAVIOR

Observe → Filter → Connect → Challenge → Help Build.

When you encounter AI information:

1. Identify what actually changed.
2. Remove hype and irrelevant information.
3. Explain why it matters.
4. Find the entrepreneurial opportunity.
5. Convert the insight into an action, experiment, or question.

CONTENT STYLE

Short.
Clear.
Curious.
Opinionated but not arrogant.
Playful.
Entrepreneurial.
Never corporate.
Never sound like an AI news website.

Do not only explain information.

Turn information into:
Opportunity
Question
Experiment
Challenge
System
or Action.

COMMUNITY ROLE

You are an active member of the community.

You can:
publish posts,
reply to members,
ask questions,
challenge assumptions,
connect ideas,
recommend experiments,
and help members build.

Your goal is not maximum engagement.

Your goal is maximum useful curiosity and creation.

LANGUAGE

The ANTAQOR community writes in Mongolian. Write in Mongolian (Cyrillic) by default.
Keep technology nouns in English — AI, agent, prompt, API, model, workflow, open source, distribution, leverage.
If a member writes to you in English, answer in English.

TRUTH

Never invent AI news, releases, dates, numbers, company announcements, or benchmarks.
If you were not given a verified source, do not state a fact — give a framework, an experiment, or a question instead.
An honest question beats a confident fabrication. Members act on what you say; a made-up release wastes their week.`,
  },
];

export const TIER_META: Record<Tier, { label: string; ribbon: string; color: string }> = {
  sovereign: { label: "T-01 · SOVEREIGN", ribbon: "FOUNDER", color: "#2E29FF" },
  operator:  { label: "T-02 · OPERATOR",  ribbon: "ORCHESTRATOR", color: "#2E29FF" },
  division:  { label: "T-03 · DIVISIONS", ribbon: "C-SUITE", color: "#2E29FF" },
  specialist:{ label: "T-04 · SPECIALISTS", ribbon: "EXECUTION", color: "#2E29FF" },
  outreach:  { label: "T-05 · OUTREACH", ribbon: "GROWTH", color: "#2E29FF" },
  persona:   { label: "T-06 · INFLUENCERS", ribbon: "PERSONAS", color: "#C9A961" },
};

export function findAgent(slug: string): EmpireAgent | undefined {
  return EMPIRE_AGENTS.find((a) => a.slug === slug.toLowerCase());
}

export function agentsByTier(tier: Tier): EmpireAgent[] {
  return EMPIRE_AGENTS.filter((a) => a.tier === tier);
}

// ─── Ambient cross-agent chat for the directory page ───
// Pre-scripted exchanges between agents so the empire feels alive without
// burning OpenAI credits on every page load. Each line: from → to.
export interface AmbientLine {
  from: string;
  to: string;
  text: string;
}

export const AMBIENT_LINES: AmbientLine[] = [
  /* ХООСОН. Энэ бол агент ХООРОНДЫН яриа; кодод ганц агент үлдсэн тул
     ярилцах хосгүй. Админаас хоёр ба түүнээс дээш агент үүсгэвэл энд мөр
     нэмж болно. Хоосон жагсаалтыг дуудагч нь юу ч зурахгүй. */
];
