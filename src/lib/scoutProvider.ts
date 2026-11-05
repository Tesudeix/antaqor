/* ─── Нийлүүлэгчийн давхарга ───────────────────────────────────────────────
   Агентын гүйлт (koreanScout) ба ойн задлалт (scoutMemory) хоёулаа НЭГ л
   газраас загвар дуудна. Хоёр тусдаа хуулбар байвал OpenAI данс сэргэхэд
   нэг нь шилжиж, нөгөө нь хоцорно.

   Chat-completions протокол OpenAI, xAI, Gemini гуравт ижил тул нэг код
   гуравуулангийн үйлчилнэ (Gemini-д OpenAI-нийцтэй хаяг бий). Дараалал:
   OpenAI → xAI Grok → Gemini. Эхнийх нь ажиллавал бусад нь дуудагдахгүй.

   2026-08-31-ний ХЭМЖИЛТ (гараар шалгав, таамаг биш):
   — OpenAI (хоёулаа түлхүүр): 429 `billing_not_active` — данс идэвхгүй.
   — xAI: 403 `permission-denied` — багийн кредит дууссан / сарын хязгаар.
   — Gemini: 200 — ГАНЦ ажиллаж байгаа нийлүүлэгч.
   Тиймээс Gemini энэ жагсаалтад орлоо. OpenAI-н төлбөр цэнэглэгдэх мөчид
   ямар ч код өөрчлөх шаардлагагүй: тэр эхнийх нь тул автоматаар эргэж
   ирнэ.                                                                   */

export interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
  openaiStyle: boolean; // gpt-5 гэр бүл max_completion_tokens шаардана
  /** Gemini 2.5/3.x нь сэтгэх (thinking) токен зарцуулдаг тул үүнийг
   *  унтраахгүй бол max_tokens нь бодолд бүтэн орж, `content` ХООСОН,
   *  `finish_reason: "length"` гэж ирдэг. Гараар батлагдсан: unтраасны
   *  дараа л жинхэнэ монгол текст буцаана. */
  noReasoning?: boolean;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface Choice {
  message?: { content?: string | null; tool_calls?: ToolCall[] };
  finish_reason?: string;
}

export function providers(): Provider[] {
  return [
    {
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      key: process.env.OPENAI_SCOUT_KEY || process.env.OPENAI_API_KEY,
      model: process.env.SCOUT_OPENAI_MODEL || "gpt-5.4-mini",
      openaiStyle: true,
    },
    {
      name: "xai",
      url: "https://api.x.ai/v1/chat/completions",
      key: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
      model: process.env.SCOUT_XAI_MODEL || "grok-4-fast-non-reasoning",
      openaiStyle: false,
    },
    {
      name: "gemini",
      // Google-ийн OpenAI-нийцтэй давхарга. Үүний ачаар адаптер бичих
      // шаардлагагүй — доорх `chatCompletion` яг хэвээрээ ажиллана.
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      openaiStyle: false,
      noReasoning: true,
    },
  ].filter((p) => !!p.key);
}

/** Яагаад нэг нийлүүлэгч алгасагдсаныг ДУУДАГЧ талд хэлэх мэдээлэл.
 *  Өмнө нь энэ нь зөвхөн `console.error` рүү явдаг байсан — сервер лог руу
 *  орох эрхгүй хүн (эзэн өөрөө) яагаад Gemini ажиллаж байгааг мэдэхгүй.
 *  Данс идэвхгүй байгаа зэрэг нь ТӨЛБӨРИЙН асуудал, кодын биш: тэрийг
 *  засах хүн нь дэлгэц хардаг хүн юм. */
export interface ProviderAttempt {
  name: string;
  model: string;
  ok: boolean;
  status?: number;
  /** OpenAI/xAI-ийн буцаадаг машин уншдаг код (billing_not_active гэх мэт). */
  code?: string;
  message?: string;
}

export async function chatCompletion(
  p: Provider,
  messages: ChatMsg[],
  opts: {
    tools?: unknown[];
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    /** gpt-5 болон Gemini бол сэтгэх загварууд: тэд `max_tokens`-ийн ихэнхийг
     *  далд бодолд зарцуулж, `content`-ыг ХООСОН буцааж мэднэ. Богино зохиолын
     *  ажилд бодол хэрэггүй тул дуудагч "minimal" гэж хэлж болно. */
    reasoning?: "none" | "minimal" | "low" | "medium" | "high";
    /** Амжилтгүй оролдлогыг дуудагчид мэдэгдэнэ (лог руу биш). */
    onAttempt?: (a: ProviderAttempt) => void;
  } = {}
): Promise<Choice | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40_000);
  try {
    const body: Record<string, unknown> = { model: p.model, messages };
    if (opts.tools) {
      body.tools = opts.tools;
      body.tool_choice = "auto";
    }
    if (p.openaiStyle) body.max_completion_tokens = opts.maxTokens ?? 900;
    else {
      body.max_tokens = opts.maxTokens ?? 900;
      body.temperature = opts.temperature ?? 0.4;
    }
    /* Gemini-д "none" нь ЗААВАЛ (эс бөгөөс хоосон хариу ирнэ, доорх
       Provider-ийн тайлбарыг үз). Бусад загварт дуудагчийн хүсэлт хүчинтэй. */
    if (p.noReasoning) body.reasoning_effort = "none";
    else if (opts.reasoning) body.reasoning_effort = opts.reasoning;

    const send = () =>
      fetch(p.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.key}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

    let res = await send();
    let errText = !res.ok ? await res.text().catch(() => "") : "";

    /* ─── `reasoning_effort`-ийн нэг удаагийн ухралт ─────────────────────
       Загвар бүр өөр өөр утга дэмждэг бөгөөд тэр жагсаалт үе үе солигддог:
       gpt-5.0 гэр бүл "minimal" авдаг, gpt-5.4-mini авдаггүй (тэр нь
       none/low/medium/high/xhigh). Дэмжигдээгүй утга нь 400 буцаадаг тул
       нэг үг зөрөхөд БҮХЭЛ нийлүүлэгч унаж, ажил дараагийн рүү шилждэг —
       гэтэл асуудал нь зөвхөн нэмэлт параметр байсан.

       Тиймээс: 400 бөгөөд алдаанд `reasoning_effort` дурдагдсан бол тэр
       талбарыг хаяад ЯГ НЭГ УДАА дахин илгээнэ. Сэтгэх нь энэ ажилд
       заавал биш — байхгүй байсан ч хариу зөв ирнэ, зөвхөн арай илүү
       токен зарцуулна. Загвар солих болгонд код засах шаардлагагүй. */
    if (
      res.status === 400 &&
      body.reasoning_effort !== undefined &&
      /reasoning_effort/i.test(errText)
    ) {
      delete body.reasoning_effort;
      res = await send();
      errText = !res.ok ? await res.text().catch(() => "") : "";
    }

    if (!res.ok) {
      const t = errText;
      console.error(`[scout] ${p.name} ${res.status}`, t.slice(0, 300));
      /* Нийлүүлэгчид алдаагаа өөр өөр бүтцээр хэлдэг: OpenAI нь
         `error.code`, xAI нь дээд түвшний `code`. Хоёуланг нь уншина —
         эс бөгөөс "яагаад" гэдэг нь JSON доторх тэмдэгт мөр хэвээр
         үлдэж, дэлгэц дээр гарахгүй. */
      let code = "";
      let message = t.slice(0, 200);
      try {
        const j = JSON.parse(t) as {
          error?: { code?: string; message?: string } | string;
          code?: string;
        };
        /* xAI нь `error`-ыг ТЭМДЭГТ МӨР болгож, кодыг дээд түвшинд тавьдаг;
           OpenAI нь `error` дотор объект өгдөг. Хоёуланг нь барихгүй бол
           xAI-ийн мессеж дэлгэц дээр түүхий JSON болж гарна. */
        const err = j.error;
        if (typeof err === "string") {
          code = j.code || "";
          message = err;
        } else {
          code = err?.code || j.code || "";
          message = err?.message || message;
        }
      } catch {
        /* JSON биш бол түүхий текст хэвээр */
      }
      opts.onAttempt?.({ name: p.name, model: p.model, ok: false, status: res.status, code, message });
      return null;
    }
    const data = (await res.json()) as { choices?: Choice[] };
    const choice = data.choices?.[0] || null;
    /* Хариу ирсэн ч агуулга нь ХООСОН байх нь бас бүтэлгүйтэл — сэтгэх
       загварууд төсвөө бодолд дуусгахад яг ингэдэг. Үүнийг "амжилт" гэж
       тоолвол дуудагч чимээгүй хоосон үр дүн авна. */
    const empty = !choice?.message?.content?.trim() && !choice?.message?.tool_calls?.length;
    opts.onAttempt?.({
      name: p.name,
      model: p.model,
      ok: !empty,
      status: res.status,
      ...(empty ? { code: "empty_content", message: "Загвар хоосон хариу буцаалаа (сэтгэх токен төсвийг идсэн байж болно)." } : {}),
    });
    return choice;
  } catch (e) {
    console.error(`[scout] ${p.name} error`, e);
    opts.onAttempt?.({
      name: p.name,
      model: p.model,
      ok: false,
      code: "network",
      message: e instanceof Error ? e.message : "Сүлжээний алдаа",
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
