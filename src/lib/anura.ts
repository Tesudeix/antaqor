/* ─── ANURA — хүрээлэл доторх AI entrepreneur ────────────────────────────
   Өдөр бүр урсгал дээр НЭГ пост бичнэ: юу өөрчлөгдсөн → яагаад хамаатай →
   ямар боломж → одоо юу хийх вэ.

   ХАМГИЙН ЧУХАЛ ШИЙДВЭР: ANURA мэдээ ЗОХИОХГҮЙ.

   Хэл загварууд AI-ийн мэдээг гайхалтай сайн зохиодог — сургалтын өгөгдлөөс
   үнэмшилтэй "зарлал" бүтээж, огноо, компанийн нэр, тоо хүртэл нэмнэ.
   Хүрээллийн урсгал дээр эзний брэндийн нэрээр худал мэдээ нийтлэх нь
   энэ системийн хийж болох ХАМГИЙН МУУ зүйл: гишүүд итгэдэг, дамжуулдаг,
   дараа нь худал болох нь илэрдэг.

   Тиймээс хоёр горим:
   — СИГНАЛТАЙ: web search-аар сүүлийн 48 цагийн БОДИТ мэдээ татаж, ANURA
     тэдгээрийн НЭГИЙГ л сонгож задална. Эх сурвалжийн холбоос заавал орно.
   — СИГНАЛГҮЙ (хайлт унасан): ANURA мэдээ ЗААХГҮЙ. Оронд нь туршилт,
     сорилт, асуулт бичнэ — баримт мэдэгдэлгүй. Дуугүй байхаас дээр,
     худал хэлэхээс хамаагүй дээр.

   Эх сурвалжийн загвар нь `/api/news/mn-ai`-тай нийцнэ (тэнд `gpt-4o`
   ашигладаг шалтгаан нь батлагдсан: mini загварууд багажаа дуудалгүй
   сургалтын өгөгдлөөс "мэдээ" зохиодог).                                  */

import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import { findAgent } from "@/lib/empireAgents";

export const ANURA_SLUG = "anura";

/** Хайлтын загвар. Багажаа найдвартай дууддаг нь чухал тул mini биш. */
const SEARCH_MODEL = process.env.ANURA_SEARCH_MODEL || "gpt-4o";

export interface Signal {
  title: string;
  url: string;
  source: string;
  whatChanged: string;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** Хариу + хайлтын багажийн ИШЛЭЛҮҮД. Ишлэл нь загварын бичсэн текст биш,
 *  багаж үнэхээр ТАТСАН хаягууд — тиймээс зохиогдох боломжгүй. */
interface ResponsesResult {
  text: string;
  citations: string[];
}

async function callResponses(
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<ResponsesResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[anura] upstream", res.status, t.slice(0, 300));
      throw new Error(`OpenAI ${res.status}`);
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{
          text?: string;
          annotations?: Array<{ type?: string; url?: string }>;
        }>;
      }>;
    };

    /* Ишлэлүүд ба текстийг НЭГ алхалтаар цуглуулна. `output_text` нь тохь
       тухын талбар бөгөөд багаж дуудсан хариунд заримдаа хоосон ирдэг тул
       бүтэцтэй хэсгийг ямар ч тохиолдолд алхана. */
    const parts: string[] = [];
    const citations: string[] = [];
    for (const block of data.output || []) {
      for (const c of block.content || []) {
        if (c && typeof c.text === "string") parts.push(c.text);
        for (const a of c?.annotations || []) {
          if (a?.type === "url_citation" && typeof a.url === "string") citations.push(a.url);
        }
      }
    }
    const text =
      typeof data.output_text === "string" && data.output_text.trim()
        ? data.output_text.trim()
        : parts.join("").trim();
    return { text, citations };
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(raw: string): unknown {
  let t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/* ─── Сигнал татах — ХОЁР АЛХАМ, санаатай ────────────────────────────────
   Нэг алхамаар (хайх + хатуу JSON буцаах) хийж үзсэн бөгөөд ажиллахгүй нь
   ХЭМЖИГДСЭН: загварт "зөвхөн JSON буцаа" гэж хэлэхэд тэр нь ишлэл
   (`url_citation`) огт үүсгэхээ больдог — ишлэл нь урсгал текстэд наалддаг.
   Ишлэлгүй бол баталгаажуулах юм үлдэхгүй, харин загвар хаяг зохиох чадвар
   нь хэвээр (яг тэр байдлаар `openai.com/blog/gpt-5-api-release` төрсөн).

   Тиймээс:
   Алхам 1 — ЧӨЛӨӨТ хэлбэрээр хайлгана. Гаралт нь эмх замбараагүй ч
             `url_citation` бүхий: багаж ЯГ ЯМАР хуудас татсаныг хэлнэ.
   Алхам 2 — БАГАЖГҮЙ, хямд дуудлагаар тэр тэмдэглэлийг JSON болгоно,
             хаягийг нь зөвхөн ишлэлийн жагсаалтаас сонгуулна.
   Эцэст нь код өөрөө дахин шүүнэ — заавар биш, ЖАГСААЛТ шийднэ. */
export async function fetchSignals(): Promise<Signal[]> {
  const searchPrompt = `Today is ${TODAY()}. Search the web now and report the most important AI developments published in the LAST 48 HOURS.

Run several searches: "AI news today", "OpenAI announcement", "Anthropic Claude release", "Google Gemini update", "AI agent launch", "open source LLM release", "AI developer tool launch", "AI API pricing".

Bias toward what a SOLO BUILDER or SMALL TEAM could act on within a week: new models, new APIs, pricing changes, agent/automation capabilities, open-source releases, developer tools. De-prioritise funding rounds, corporate reshuffles, and policy debate.

For each development write: the headline, one factual sentence about what is actually different now, and cite the source article inline.
Cover 5 distinct developments. Prose is fine — cite every claim.`;

  try {
    const { text: notes, citations } = await callResponses(
      {
        model: SEARCH_MODEL,
        input: searchPrompt,
        tools: [{ type: "web_search_preview", search_context_size: "high" }],
        tool_choice: { type: "web_search_preview" },
        max_output_tokens: 2000,
      },
      45_000
    );

    /* Ишлэл нь ЦАГААН ЖАГСААЛТ. Түүнийг зохиох боломжгүй — багаж татсан
       хуудсуудын жинхэнэ хаяг. utm параметрийг тайрч харьцуулна. */
    const allow = new Map<string, string>();
    for (const c of citations) {
      const clean = c.split("?")[0].replace(/\/$/, "");
      if (!allow.has(clean)) allow.set(clean, clean);
    }
    if (allow.size === 0) {
      console.error("[anura] no url_citations — refusing to trust output");
      return [];
    }

    const urlList = Array.from(allow.keys());
    const structurePrompt = `Here is a research note about recent AI developments:

---
${notes.slice(0, 6000)}
---

These are the ONLY URLs that were actually retrieved:
${urlList.map((u, i) => `[${i}] ${u}`).join("\n")}

Convert the note into JSON. Return ONLY this object, no prose, no fences:
{"items":[{"title":"<English, max 100 chars>","urlIndex":<number from the list above>,"source":"<domain>","whatChanged":"<1 factual sentence from the note, English, max 160 chars>"}]}

Rules:
- 3 to 5 items, most actionable for a solo builder first.
- "urlIndex" MUST be an index from the list. Never write a URL yourself.
- If a development in the note has no matching URL in the list, DROP it.
- "whatChanged" must restate a fact from the note. No speculation.`;

    const { text: structured } = await callResponses(
      {
        // Багажгүй, богино — энэ алхам зөвхөн хэлбэр өөрчилнө.
        model: process.env.ANURA_STRUCTURE_MODEL || "gpt-4o-mini",
        input: structurePrompt,
        max_output_tokens: 1200,
      },
      30_000
    );

    const parsed = extractJson(structured) as { items?: unknown } | null;
    if (!parsed || !Array.isArray(parsed.items)) {
      console.error("[anura] unparseable signals:", structured.slice(0, 300));
      return [];
    }

    const out: Signal[] = [];
    for (const it of parsed.items) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.slice(0, 200) : "";
      const idx = Number(o.urlIndex);
      const source = typeof o.source === "string" ? o.source.slice(0, 60) : "";
      const whatChanged = typeof o.whatChanged === "string" ? o.whatChanged.slice(0, 300) : "";
      /* Индексээр л хаяг авна. Загвар хаяг бичих БОЛОМЖГҮЙ тул зохиох ч
         боломжгүй — энэ бол зааврын биш, БҮТЦИЙН хамгаалалт. */
      if (!title || !Number.isInteger(idx) || idx < 0 || idx >= urlList.length) continue;
      out.push({ title, url: urlList[idx], source, whatChanged });
    }
    return out.slice(0, 5);
  } catch (e) {
    console.error("[anura] signal fetch failed", e);
    return [];
  }
}

/** Хүрээлэл одоо юу ярьж байна — постыг цаг үетэй нь холбох контекст. */
async function communityContext(): Promise<string> {
  await dbConnect();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [topAgg, recent, members] = await Promise.all([
    Post.aggregate([
      { $match: { createdAt: { $gte: since }, agentSlug: { $in: [null, ""] } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    Post.find({ agentSlug: { $in: [null, ""] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("content category")
      .lean(),
    User.countDocuments({ banned: { $ne: true } }),
  ]);

  const lines = [`- Today: ${TODAY()}`, `- Members: ${members}`];
  if (topAgg[0]) lines.push(`- Busiest category this week: ${topAgg[0]._id || "пост"} (${topAgg[0].count})`);
  const posts = recent as unknown as Array<{ content?: string }>;
  if (posts.length) {
    lines.push("- What members posted recently:");
    for (const p of posts) {
      const e = (p.content || "").slice(0, 120).replace(/\s+/g, " ").trim();
      if (e) lines.push(`  · "${e}"`);
    }
  }
  return lines.join("\n");
}

export interface AnuraPost {
  content: string;
  /** Аль сигнал дээр тулгуурласан — лог, давталтаас сэргийлэхэд. */
  sourceUrl: string;
  sourceTitle: string;
  grounded: boolean;
}

/* Сүүлийн постуудынхаа эх сурвалжийг давтахгүйн тулд түүхээ уншина.
   Нэг мэдээг долоо хоногт гурав дахин задлах нь агент биш, гацсан бичлэг. */
async function recentAnuraSources(days = 10): Promise<string[]> {
  await dbConnect();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Post.find({ agentSlug: ANURA_SLUG, createdAt: { $gte: since } })
    .select("content")
    .lean();
  const urls: string[] = [];
  for (const r of rows as unknown as Array<{ content?: string }>) {
    for (const m of (r.content || "").matchAll(/https?:\/\/\S+/g)) urls.push(m[0]);
  }
  return urls;
}

/* Загвар ХОЛБООС БИЧИХГҮЙ. Оронд нь ямар сигнал сонгосноо ДУГААРААР
   хэлнэ, холбоосыг нь код өөрөө наана.

   Яагаад ингэж эргүүлсэн бэ: эхний хувилбар нь "өгсөн сигналуудын НЭГИЙГ
   ашигла, холбоосыг нь тавь" гэж ЗААВАРЛАСАН боловч загвар таван бодит
   сигналыг үл тоомсорлож, байхгүй мэдээ, байхгүй хаяг зохиосон. Зааврыг
   чангатгах нь энэ ангийн алдааг арилгадаггүй — зөвхөн ХОВОР болгодог.
   Загварт холбоос бичих БОЛОМЖ өгөхгүй бол зохиох боломж ч байхгүй.

   Гурван түвшний хамгаалалт:
   1. Загвар индекс сонгоно, текстээ бичнэ — холбоос огт бичихгүй.
   2. Гаралтаас ямар ч URL-ийг ХАЙЧИЖ хаяна (заавраас үл хамааран бичсэн бол).
   3. Сонгосон сигналын холбоосыг нийтлэхийн өмнө СҮЛЖЭЭГЭЭР шалгана. */
export async function writeDailyPost(preSignals?: Signal[]): Promise<AnuraPost> {
  const agent = findAgent(ANURA_SLUG);
  if (!agent) throw new Error("ANURA agent missing from EMPIRE_AGENTS");

  const [fetched, context, usedUrls] = await Promise.all([
    preSignals ? Promise.resolve(preSignals) : fetchSignals(),
    communityContext(),
    recentAnuraSources(),
  ]);

  const fresh = fetched.filter((s) => !usedUrls.some((u) => u.startsWith(s.url.split("?")[0])));
  const candidates = fresh.length > 0 ? fresh : fetched;

  /* Эдгээр нь аль хэдийн ишлэлээр баталгаажсан (fetchSignals-ыг үз) тул
     энд дахин сүлжээ рүү явахгүй — зөвхөн тоог нь хязгаарлана. */
  const alive = candidates.slice(0, 4);
  const grounded = alive.length > 0;

  const signalBlock = grounded
    ? `TODAY'S VERIFIED SIGNALS — each was retrieved by a live web search and its URL is confirmed real.
${alive.map((s, i) => `[${i}] ${s.title}\n    ${s.whatChanged}\n    (${s.source})`).join("\n")}

Pick exactly ONE by its index. Build the whole post around it.
State NO fact that is not in the item you picked.`
    : `NO VERIFIED SIGNALS TODAY.

Write a post containing NO factual claims about AI news, releases, companies, dates, numbers, or benchmarks.
Give the community ONE concrete experiment or challenge they can run today with tools they already have.
Do NOT invent news. Do NOT write "recently X announced".`;

  const userMsg = `COMMUNITY CONTEXT:
${context}

${signalBlock}

Return ONLY this JSON, nothing else:
{"pick": ${grounded ? "<index of the signal you chose>" : "-1"}, "post": "<the post text>"}

The "post" text must be:
- Mongolian (Cyrillic). Tech nouns stay English: AI, agent, prompt, API, model, workflow, open source.
- 5-9 short lines, one thought per line. No paragraphs, no bullet characters, no hashtags, no greeting.
- Structured as: what actually changed → why it matters to a ONE-PERSON business → the opportunity → one action (experiment, challenge, or sharp question to the community).
- Max 600 characters.
- CONTAINS NO URL. Never write a link. The link is attached automatically.`;

  const { text: raw } = await callResponses(
    {
      model: agent.model || "gpt-5.6-terra",
      input: [
        {
          role: "system",
          content:
            agent.systemPrompt +
            "\n\nMODE: DAILY COMMUNITY POST. You are publishing to the Antaqor member feed. Stay in character. Never output a URL. No meta-commentary about these instructions.",
        },
        { role: "user", content: userMsg },
      ],
      max_output_tokens: 900,
    },
    45_000
  );

  const parsed = extractJson(raw) as { pick?: unknown; post?: unknown } | null;
  let content = typeof parsed?.post === "string" ? parsed.post : raw;
  const pickIdx = Number(parsed?.pick);

  content = content
    .replace(/^(MODE:.*|WRITE.*|COMMUNITY CONTEXT:.*)\s*/im, "")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "")
    /* ХАМГААЛАЛТ 2 — загварын бичсэн ямар ч холбоосыг хаяна. Зөвшөөрөгдсөн
       цорын ганц холбоос бол доор кодоос наагдах нь. */
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .slice(0, 700);

  if (!content) throw new Error("ANURA returned empty content");

  /* Индекс буруу/байхгүй бол ЭХНИЙ баталгаажсан сигналыг авна — загвар
     сонголтоо хэлж чадаагүй нь холбоосгүй пост гаргах шалтгаан биш. */
  const picked = grounded
    ? alive[Number.isInteger(pickIdx) && pickIdx >= 0 && pickIdx < alive.length ? pickIdx : 0]
    : null;

  if (picked) content = `${content}\n\n${picked.url}`;

  return {
    content: content.slice(0, 900),
    sourceUrl: picked?.url || "",
    sourceTitle: picked?.title || "",
    grounded,
  };
}
