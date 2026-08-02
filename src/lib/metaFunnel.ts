// Stateful multi-step DM funnels (e.g. HR qualifying).
// Stored on MetaConversation.funnel = { name, step, answers }.
// Each funnel finishes by generating a finalize reply via Grok and
// optionally pinging an admin Telegram channel for hot lead handoff.

import mongoose from "mongoose";
import MetaConversation from "@/models/MetaConversation";
import MetaSettings from "@/models/MetaSettings";
import { generateReply } from "./metaAI";
import { nextDynamicMove, DynamicAgentSpec } from "./dynamicAgent";

export interface FunnelStep {
  key: string;
  question: string;
  // Optional tappable answer chips (sent as quick replies).
  options?: string[];
  // Optional named validator — re-asks the same step until the answer passes.
  //   phone8 — Mongolian 8-digit phone (digits are extracted before checking).
  validate?: "phone8";
  // Message shown when validation fails (falls back to a sensible default).
  retry?: string;
}

export type FunnelMode = "static" | "dynamic";

export interface FunnelDef {
  name: string;
  mode: FunnelMode;
  hotLeadTitle: string;
  finalizePrompt: (answers: Record<string, string>) => string;
  // Deterministic final message (skips AI) — for simple capture funnels.
  staticFinal?: (answers: Record<string, string>) => string;
  // Static-mode only — fixed question list
  steps?: FunnelStep[];
  // Dynamic-mode only — AI-driven conversation agent
  dynamic?: DynamicAgentSpec;
  // Opening line for dynamic mode (sent on funnel start before AI takes over)
  openingQuestion?: string;
  // Tappable chips for the opening question (dynamic mode)
  openingOptions?: string[];
}

export const HR_FUNNEL: FunnelDef = {
  name: "hr",
  mode: "static",
  hotLeadTitle: "HR агентлаг",
  steps: [
    {
      key: "industry",
      question: "Ok 3 quick асуулт 🚀\n1/3 — Салбар чинь юу?",
      options: ["E-commerce", "Restaurant", "IT / Tech", "Mining", "Бусад"],
    },
    {
      key: "headcount",
      question: "2/3 — Хэдийг авмаар байна?",
      options: ["1-5 хүн", "6-15 хүн", "15+ хүн", "Тодорхойгүй"],
    },
    {
      key: "budget",
      question: "3/3 — Recruit-д төсөв хэр вэ?",
      options: ["<₮2М", "₮2-5М", "₮5М+", "Зөвлөгөө хэрэгтэй"],
    },
  ],
  finalizePrompt: (a) => `
HR агентлагийн head зөвлөх. Доорх профайлд тохирох багц сонгож санал болго.

Профайл:
• Салбар: ${a.industry}
• Headcount: ${a.headcount}
• Цалин/Төсөв: ${a.budget}

Багц:
• Starter (≤5 hire / 6 сар): ₮1.5М setup + ₮500К/hire
• Growth (6-15 hire): ₮3М setup + ₮400К/hire
• Empire (15+ hire): ₮5М setup + ₮300К/hire

Reply: яг 3 өгүүлбэр. Plain text. Cool playful founder өнгө. Max 1 emoji.
Sentence 1: match хийсэн багцыг шууд нэрлэ + үнэ MNT-р.
Sentence 2: 1-2 key deliverable (screening + shortlist + 90-day guarantee хэлэх).
Sentence 3: CTA — "Founder 24 цагт холбогдоно — antaqor.com/hr-call эсвэл «тийм» гэж бич."`,
};

// Static discovery funnel — fixed quick-reply questions so EVERY completed
// танилцлага reliably yields role + age + gender + interest + goal into
// MetaConversation.profile.intro (admin Leads board renders them generically).
export const INTRO_FUNNEL: FunnelDef = {
  name: "intro",
  mode: "static",
  hotLeadTitle: "Танилцлага",
  steps: [
    {
      key: "role",
      question: "Хөөе найз 👋 Танилцъя! Чи юу хийдэг хүн бэ?",
      options: ["Founder", "Freelancer", "Ажилтан", "Оюутан", "Бусад"],
    },
    {
      key: "phone",
      question: "📱 Утасны дугаараа үлдээгээрэй — Antaqor шууд холбогдоно (жишээ: 99xxxxxx):",
    },
    {
      key: "age",
      question: "Хэдэн настай вэ? 🎂",
      options: ["18-24", "25-34", "35-44", "45+"],
    },
    {
      key: "gender",
      question: "Хүйс?",
      options: ["Эр", "Эм", "Хэлэхгүй"],
    },
    {
      key: "interest",
      question: "Юу хамгийн их сонирхдог вэ?",
      options: ["AI / Tech", "Бизнес", "Контент", "Дизайн", "Бусад"],
    },
    {
      key: "goal",
      question: "Antaqor-оос юу авмаар байна?",
      options: ["Хичээл", "HR / ажилтан", "Strategy зөвлөгөө", "Community", "Зүгээр сонирхож"],
    },
  ],
  finalizePrompt: (a) => `
Antaqor-ын founder өнгөтэй AI agent. Шинэ хэрэглэгчтэй танилцаж дуусаад тохирох замаа санал болгох ёстой.

Profile:
• Юу хийдэг: ${a.role}
• Утас: ${a.phone}
• Нас: ${a.age}
• Хүйс: ${a.gender}
• Сонирхол: ${a.interest}
• Хайж байгаа зүйл: ${a.goal}

Reply: яг 3 өгүүлбэр. Plain text. Cool найз tone. Max 1 emoji.
Sentence 1: profile-аас нэгийг тусгаж "got it / ойлгосон" гэх founder өнгөтэй acknowledge.
Sentence 2: тэдний "goal"-д хамгийн тохирох нэг next action санал болго — нэг л link/CTA сонго:
  • Хичээл → antaqor.com/classroom
  • HR / ажилтан → IG-н ≡ цэснээс "HR агентлаг" товч даргах
  • Strategy / founder зөвлөгөө → antaqor.com/strategy-call
  • Community → antaqor.com/community
Sentence 3: 1 line follow-up асуулт — яриа цааш үргэлжлэхэд найз tone.`,
};

export const BOOK_FUNNEL: FunnelDef = {
  name: "book",
  mode: "static",
  hotLeadTitle: "Захиалга / Lead",
  steps: [
    { key: "phone", question: "Захиалгыг тань авъя 📅\nУтасны дугаараа үлдээнэ үү:" },
    { key: "time", question: "Ямар өдөр / цагт таатай вэ?", options: ["Өнөөдөр", "Маргааш", "Энэ долоо хоног", "Амралтын өдөр"] },
  ],
  staticFinal: (a) => `Баярлалаа! 🙌 Захиалгыг тань хүлээн авлаа.\n📞 ${a.phone || "-"}\n🕐 ${a.time || "-"}\nБид тантай удахгүй холбогдоно.`,
  finalizePrompt: (a) => `Booking received phone ${a.phone} time ${a.time}. One short friendly Mongolian confirmation.`,
};

// Order-capture funnel for shops — item → 8-digit phone → delivery address.
// Deterministic confirmation (staticFinal, no AI) and the completed answers are
// DMed to the owner as a hot lead via alertHotLead (runFunnelTurn fires it).
export const ORDER_FUNNEL: FunnelDef = {
  name: "order",
  mode: "static",
  hotLeadTitle: "Захиалга 🛒",
  steps: [
    { key: "item", question: "Юу, хэдийг авах вэ? 🛒\n(жишээ: Хар цамц · M размер · 2ш)" },
    {
      key: "phone",
      question: "📱 Утасны дугаараа бичнэ үү (8 оронтой):",
      validate: "phone8",
      retry: "Утасны дугаар буруу байна 🙏 8 оронтой дугаараа дахин бичээрэй (жишээ: 99112233):",
    },
    { key: "address", question: "🚚 Хүргэлтийн хаягаа бичнэ үү (дүүрэг · хороо · байр/тоот):" },
  ],
  staticFinal: (a) =>
    `Баярлалаа! 🙌 Захиалгыг тань хүлээн авлаа.\n🛒 ${a.item || "-"}\n📞 ${a.phone || "-"}\n🚚 ${a.address || "-"}\n\nБид тантай удахгүй холбогдоно ✨`,
  finalizePrompt: (a) =>
    `Order received: ${a.item}, phone ${a.phone}, address ${a.address}. One short friendly Mongolian confirmation.`,
};

export const FUNNELS: Record<string, FunnelDef> = {
  intro: INTRO_FUNNEL,
  hr: HR_FUNNEL,
  book: BOOK_FUNNEL,
  order: ORDER_FUNNEL,
};

export interface FunnelState {
  name: string;
  step: number;
  answers: Record<string, string>;
  // Dynamic-mode only — running conversation transcript
  history?: Array<{ role: "assistant" | "user"; content: string }>;
}

export async function startFunnel(
  convId: string,
  funnelName: string
): Promise<{ ok: boolean; firstQuestion?: string; options?: string[] }> {
  const def = FUNNELS[funnelName];
  if (!def) return { ok: false };

  let firstQuestion: string | undefined;
  let options: string[] | undefined;
  if (def.mode === "static") {
    if (!def.steps || def.steps.length === 0) return { ok: false };
    firstQuestion = def.steps[0].question;
    options = def.steps[0].options;
  } else {
    firstQuestion = def.openingQuestion || "Сайн уу 👋 өөрийнхөө талаар хэлээрэй.";
    options = def.openingOptions;
  }

  await MetaConversation.findByIdAndUpdate(convId, {
    funnel: {
      name: funnelName,
      step: 0,
      answers: {},
      ...(def.mode === "dynamic"
        ? { history: [{ role: "assistant", content: firstQuestion }] }
        : {}),
    },
  });
  return { ok: true, firstQuestion, options };
}

export async function cancelFunnel(convId: string) {
  await MetaConversation.findByIdAndUpdate(convId, { $unset: { funnel: 1 } });
}

export interface AdvanceResult {
  done: boolean;
  nextQuestion?: string;
  options?: string[];
  finalText?: string;
  answers?: Record<string, string>;
  funnelName?: string;
}

// Capture user's reply, return next question (or final reply if done).
// Static: fixed step list. Dynamic: Grok agent picks next move.
export async function advanceFunnel(
  convId: string,
  userText: string
): Promise<AdvanceResult | null> {
  const conv = (await MetaConversation.findById(convId).lean()) as {
    funnel?: FunnelState;
  } | null;
  if (!conv?.funnel?.name) return null;
  const def = FUNNELS[conv.funnel.name];
  if (!def) return null;

  return def.mode === "static"
    ? advanceStatic(convId, def, conv.funnel, userText)
    : advanceDynamic(convId, def, conv.funnel, userText);
}

async function advanceStatic(
  convId: string,
  def: FunnelDef,
  state: FunnelState,
  userText: string
): Promise<AdvanceResult | null> {
  const stepDef = def.steps?.[state.step];
  if (!stepDef) return null;

  // Per-step validation — re-ask the SAME step (no advance) until it passes.
  let value = userText.slice(0, 500);
  if (stepDef.validate === "phone8") {
    const digits = value.replace(/\D/g, "");
    if (!/^[0-9]{8}$/.test(digits)) {
      return {
        done: false,
        nextQuestion: stepDef.retry || "Утасны дугаар буруу байна. 8 оронтой дугаар бичнэ үү:",
        options: stepDef.options,
      };
    }
    value = digits; // normalise to bare 8 digits for the lead summary
  }

  const answers = {
    ...(state.answers || {}),
    [stepDef.key]: value,
  };

  const nextStep = state.step + 1;
  if (def.steps && nextStep < def.steps.length) {
    await MetaConversation.findByIdAndUpdate(convId, {
      funnel: { name: def.name, step: nextStep, answers },
    });
    return {
      done: false,
      nextQuestion: def.steps[nextStep].question,
      options: def.steps[nextStep].options,
    };
  }

  return finalizeFunnel(convId, def, answers);
}

async function advanceDynamic(
  convId: string,
  def: FunnelDef,
  state: FunnelState,
  userText: string
): Promise<AdvanceResult | null> {
  if (!def.dynamic) return null;

  // Append the user's reply to the running transcript.
  const history = [
    ...(state.history || []),
    { role: "user" as const, content: userText.slice(0, 800) },
  ];
  const questionsAsked = state.step + 1;

  let move: Awaited<ReturnType<typeof nextDynamicMove>>;
  try {
    move = await nextDynamicMove(def.dynamic, {
      history,
      facts: state.answers || {},
      questionsAsked,
    });
  } catch (err) {
    console.error("[funnel/dynamic] agent error, finalizing", err);
    // Defensive finalize with whatever we have.
    return finalizeFunnel(convId, def, state.answers || {});
  }

  if (move.action === "done") {
    return finalizeFunnel(convId, def, move.facts);
  }

  // ASK — persist updated state + history with the new assistant question.
  const newHistory = [
    ...history,
    { role: "assistant" as const, content: move.question! },
  ];
  await MetaConversation.findByIdAndUpdate(convId, {
    funnel: {
      name: def.name,
      step: questionsAsked,
      answers: move.facts,
      history: newHistory.slice(-20), // cap history to last 20 turns
    },
  });
  return { done: false, nextQuestion: move.question, options: move.options };
}

async function finalizeFunnel(
  convId: string,
  def: FunnelDef,
  answers: Record<string, string>
): Promise<AdvanceResult> {
  let finalText: string;
  if (def.staticFinal) {
    finalText = def.staticFinal(answers);
  } else {
    const settings = await MetaSettings.findOne({ singleton: "main" });
    const gen = await generateReply(def.finalizePrompt(answers), settings);
    const fallback =
      def.name === "hr"
        ? "Founder Антакор 24 цагт холбогдоно. Starter ₮1.5М / Growth ₮3М / Empire ₮5М."
        : "Ойлгосон, найз. Antaqor classroom-аас эхлэх нь зөв алхам — antaqor.com/classroom.";
    finalText = gen.ok ? gen.text : fallback;
  }

  const intentScore = def.name === "hr" || def.name === "book" ? 100 : 60;
  const intentLabel: "hot" | "warm" = def.name === "hr" || def.name === "book" ? "hot" : "warm";

  // Build the whole profile object rather than using a `profile.<name>`
  // dot-path: existing docs may have `profile: null`, and Mongo cannot create
  // a sub-field inside null (throws "Cannot create field ... in element {profile: null}").
  const existing = await MetaConversation.findById(convId)
    .select("profile")
    .lean<{ profile?: Record<string, unknown> | null }>();
  const profile = {
    ...(existing?.profile || {}),
    [def.name]: { ...answers, completedAt: new Date() },
  };

  await MetaConversation.findByIdAndUpdate(convId, {
    $unset: { funnel: 1 },
    $set: {
      profile,
      intentScore,
      intentLabel,
    },
  });

  return { done: true, finalText, answers, funnelName: def.name };
}

// Notify admin team of hot lead.
// Telegram if TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID set, else console only.
export async function alertHotLead(
  funnelName: string,
  conv: {
    _id: mongoose.Types.ObjectId | string;
    platform: string;
    partnerId: string;
    partnerName?: string;
  },
  answers: Record<string, string>
) {
  const def = FUNNELS[funnelName];
  const title = def?.hotLeadTitle || funnelName.toUpperCase();
  const who = conv.partnerName ? `${conv.partnerName} (${conv.partnerId})` : conv.partnerId;
  const lines = [
    `🔥 HOT LEAD — ${title}`,
    ``,
    `Platform: ${conv.platform}`,
    `From: ${who}`,
    ``,
    ...Object.entries(answers).map(([k, v]) => `• ${k}: ${v}`),
    ``,
    `IG Inbox: https://www.instagram.com/direct/inbox/`,
    `Admin: https://antaqor.com/admin/meta/conversations/${conv._id}`,
  ];
  const summary = lines.join("\n");

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) {
    console.log("[funnel] HOT LEAD (no telegram configured):\n" + summary);
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: summary }),
    });
  } catch (err) {
    console.error("[funnel] telegram alert failed", err);
  }
}

// Soft-exit keywords — if user types these inside a funnel, cancel and fall
// through to the normal command path. Prefix-matched (e.g. "cancel please").
const EXIT_KW = ["болих", "болио", "цуцлах", "cancel", "human", "хүн", "stop"];

// Restart/greeting words — an exact-match safety valve so a half-finished funnel
// can never trap the thread in silence. Exact match only (not prefix) so genuine
// funnel answers like "Hi, I'm Bob" aren't misread as an exit.
const RESTART_KW = [
  "hi", "hello", "hey", "сайн уу", "сайнуу", "сайн", "menu", "цэс",
  "эхлэх", "эхлүүл", "start", "help", "тусламж", "?",
];

export function isFunnelExit(text: string): boolean {
  const t = text.trim().toLowerCase();
  return EXIT_KW.some((w) => t === w || t.startsWith(w + " ")) || RESTART_KW.includes(t);
}
