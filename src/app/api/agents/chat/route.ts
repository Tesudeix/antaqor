import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { resolveOne } from "@/lib/agentRoster";
import { chatCompletion, type ChatMsg, type Provider, type ProviderAttempt } from "@/lib/scoutProvider";
import {
  AGENT_CHAT_COST,
  AGENT_CHAT_MAX_CHARS,
  AGENT_CHAT_MAX_TURNS,
  AGENT_CHAT_MAX_TOTAL,
} from "@/lib/agentChat";

export const dynamic = "force-dynamic";

/* ─── Агенттай ярих (2026-11-10 шинэчлэл) ────────────────────────────────
   ӨМНӨ: `findAgent()` — зөвхөн КОДЫН агент. Админаас үүсгэсэн агент
   ростерт харагддаг мөртлөө эндээс 404 авдаг байв. Мөн ганц OpenAI-ийн
   Responses API руу залгадаг байсан тул тэр данс унахад агент бүхэлдээ
   дуугүй болдог.

   ОДОО:
   — `resolveOne()` — код + DB нийлсэн ростер. Идэвхгүй агент = 404.
   — Нийлүүлэгчийн гинж: OpenAI → Gemini. Эхнийх нь хариулбал хоёр дахь
     дуудагдахгүй; хоосон хариу ч бүтэлгүйтэлд тооцогдоно.
   — Админаас бичсэн prompt ҮГЧЛЭН очно. Кодын агентад (ANURA) хэрэглэгчийн
     нэрийг залгадаг хэвээр; эзний өөрийн бичсэн зааварт юм нэмбэл түүний
     хатуу дүрмийг ("120 үг" гэх мэт) эвдэж мэднэ.
   — Төлбөр хэвээр: эхлээд хасна, бүтэлгүйтвэл буцаана. Админ/эзний данс
     хасагддаггүй тул ТЭДЭНД БУЦААЛТ ч хийхгүй (өмнө нь алдаа гарах бүрд
     эзний дансанд 100 кр НЭМЭГДДЭГ байсан). */

const COST = AGENT_CHAT_COST;
const REASON = "AI_AGENT_CHAT";

interface ClientMsg {
  role: "user" | "assistant";
  content: string;
}

interface Step {
  p: Provider;
  maxTokens: number;
  timeoutMs: number;
}

/* Хоёр алхмын нийлбэр 50с — nginx-ийн 60с-ийн дотор багтана. Тэгэхгүй бол
   хоёр дахь нийлүүлэгч хариулж амжсан ч хэрэглэгч 504 харна, кредит нь
   хасагдсан хэвээр үлдэнэ. */
function chain(agentModel?: string): Step[] {
  const out: Step[] = [];
  const openaiKey = process.env.OPENAI_SCOUT_KEY || process.env.OPENAI_API_KEY;
  if (openaiKey) {
    out.push({
      p: {
        name: "openai",
        url: "https://api.openai.com/v1/chat/completions",
        key: openaiKey,
        model: agentModel || process.env.OPENAI_AGENT_MODEL || "gpt-5.6-terra",
        openaiStyle: true,
      },
      maxTokens: 2500,
      timeoutMs: 28_000,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    out.push({
      p: {
        name: "gemini",
        url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        key: process.env.GEMINI_API_KEY,
        /* 3-flash нь бодох загвар: `reasoning_effort: low` + 2500 токен
           өгөхөд бүтэн хариу ирдэг (2026-11-10 гараар шалгав). */
        model: process.env.GEMINI_AGENT_MODEL || "gemini-3-flash-preview",
        openaiStyle: false,
      },
      maxTokens: 2500,
      timeoutMs: 22_000,
    });
  }
  return out;
}

/* Данс нь хаагдсан нийлүүлэгч рүү мессеж бүрд дахин залгах нь хэрэглэгчийг
   дэмий хүлээлгэнэ. Төлбөр/эрхийн алдаа авбал 10 минут алгасна. Бүгд
   алгасагдсан бол жагсаалтыг бүтнээр нь оролдоно — хаалттай үлдэхгүй. */
const skipUntil = new Map<string, number>();
function note(a: ProviderAttempt) {
  if (a.ok) {
    skipUntil.delete(a.name);
    return;
  }
  const text = `${a.code || ""} ${a.message || ""}`;
  const dead =
    a.status === 401 ||
    a.status === 402 ||
    a.status === 403 ||
    (a.status === 429 && /billing|quota|insufficient|credit/i.test(text));
  if (dead) skipUntil.set(a.name, Date.now() + 10 * 60_000);
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
  const slug = String(body.slug || "").toLowerCase().trim();
  if (!slug) {
    return NextResponse.json({ error: "Агент олдсонгүй" }, { status: 404 });
  }

  let found: Awaited<ReturnType<typeof resolveOne>> = null;
  try {
    found = await resolveOne(slug);
  } catch (e) {
    console.error("[agents/chat] roster", e);
    return NextResponse.json({ error: "Агентын жагсаалт ачаалсангүй. Дахин оролдоно уу." }, { status: 500 });
  }
  if (!found || !found.active) {
    return NextResponse.json({ error: "Агент олдсонгүй" }, { status: 404 });
  }
  const agent = found;

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "Мессеж хоосон" }, { status: 400 });
  }
  const last = incoming[incoming.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string" || !last.content.trim()) {
    return NextResponse.json({ error: "Хүчингүй формат" }, { status: 400 });
  }

  /* Цэвэрлэх + хэмжээг барих. Түүхийг ТӨГСГӨЛӨӨС нь тоолж авна: хамгийн
     сүүлийн мессеж (хэрэглэгчийн одоогийн асуулт) хэзээ ч таслагдахгүй. */
  const clean: ClientMsg[] = incoming
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, AGENT_CHAT_MAX_CHARS) }))
    .slice(-AGENT_CHAT_MAX_TURNS);

  const kept: ClientMsg[] = [];
  let total = 0;
  for (let i = clean.length - 1; i >= 0; i--) {
    total += clean[i].content.length;
    if (kept.length > 0 && total > AGENT_CHAT_MAX_TOTAL) break;
    kept.unshift(clean[i]);
  }
  /* Яриа хэрэглэгчээр эхлэх ёстой — Gemini эхний ээлж нь загварынх байвал
     татгалздаг. Таслалтын дараа толгойд үлдсэн агентын хариуг хаяна. */
  while (kept.length > 0 && kept[0].role === "assistant") kept.shift();
  if (kept.length === 0) {
    return NextResponse.json({ error: "Хүчингүй формат" }, { status: 400 });
  }

  const all = chain(agent.model);
  if (all.length === 0) {
    return NextResponse.json({ error: "AI тохиргоо байхгүй" }, { status: 500 });
  }
  const now = Date.now();
  const live = all.filter((s) => (skipUntil.get(s.p.name) || 0) < now);
  const steps = live.length > 0 ? live : all;

  // Charge first (atomic). Refund on upstream failure.
  const spend = await spendCredits({
    userId,
    amount: COST,
    reason: REASON,
    ref: agent.slug,
    meta: { slug: agent.slug, model: steps[0].p.model },
  });
  if (!spend.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй (${spend.balance}/${COST}).`, credits: spend.balance, required: COST },
      { status: 402 }
    );
  }
  /* Админ/эзний данснаас юу ч хасагдаагүй (`required: 0`). */
  const charged = spend.required > 0;
  const refund = async (): Promise<number> => {
    if (!charged) return spend.balance;
    try {
      const r = await refundCredits({ userId, amount: COST, reason: REASON, ref: agent.slug });
      return r.balance;
    } catch (e) {
      console.error("[agents/chat] refund failed", e);
      return spend.balance;
    }
  };

  /* ─── Заавар ─────────────────────────────────────────────────────────
     Кодын агент: нэрээр нь хандах боломж өгнө (хувийн талбар задлахгүй —
     зөвхөн харагдах нэр, имэйлийн домэйн).
     Админы агент: эзний бичсэн prompt яг тэр чигээрээ. */
  let system = agent.systemPrompt;
  if (!agent.custom) {
    const sessionUser = session.user as { name?: string; email?: string };
    const userName = (sessionUser?.name || "").trim();
    const userEmail = (sessionUser?.email || "").toLowerCase();
    if (userName) {
      system += `\n\nUSER PROFILE:\n- Name: ${userName.slice(0, 80)}\n- Email domain: ${userEmail.split("@")[1] || "?"}\nWhen useful, address them by name on the first turn. If they mention a domain or business already, reflect it back. Never ask for their name — you already have it.`;
    }
  }

  const messages: ChatMsg[] = [{ role: "system", content: system }, ...kept];

  let reply = "";
  let via = "";
  const attempts: ProviderAttempt[] = [];
  try {
    for (const s of steps) {
      const choice = await chatCompletion(s.p, messages, {
        maxTokens: s.maxTokens,
        timeoutMs: s.timeoutMs,
        reasoning: "low",
        onAttempt: (a) => {
          attempts.push(a);
          note(a);
        },
      });
      const text = (choice?.message?.content || "").trim();
      if (text) {
        reply = text;
        via = `${s.p.name}:${s.p.model}`;
        break;
      }
    }
  } catch (e) {
    console.error("[agents/chat] error", e);
  }

  if (!reply) {
    console.error(
      "[agents/chat] all providers failed",
      agent.slug,
      attempts.map((a) => `${a.name}/${a.model}:${a.status || a.code || "?"}`).join(" → ")
    );
    const balance = await refund();
    return NextResponse.json(
      {
        error: charged ? "Агент түр доголдов. Кредит буцаагдлаа." : "Агент түр доголдов. Дахин оролдоно уу.",
        credits: balance,
      },
      { status: 502 }
    );
  }

  if (attempts.length > 1) console.warn("[agents/chat] fallback used", agent.slug, via);

  return NextResponse.json({
    reply,
    credits: spend.balance,
    charged: charged ? COST : 0,
    agent: agent.slug,
  });
}
