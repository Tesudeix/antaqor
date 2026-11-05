/* ─── Агентын нийтлэл бичих ерөнхий давхарга ─────────────────────────────
   ANURA нь ӨӨРИЙН зохиогчтой (`anura.ts`): тэр гадаад мэдээ татаж, эх
   сурвалж баталгаажуулдаг тул хамаагүй хатуу хамгаалалттай. Бусад агент
   мэдээ ярихгүй — тэд ХҮРЭЭЛЛИЙН өнөөдрийн байдал дээр тулгуурлаж,
   өөрсдийн үүргийн өнцгөөс бичнэ.

   ЯАГААД ЭНЭ ЯЛГАА ЧУХАЛ ВЭ: гадаад ертөнцийн тухай баримт хэлэх нь
   баталгаа шаарддаг, дотоод хүрээллийн тухай ярих нь шаарддаггүй.
   Хоёрыг нэг замаар бичүүлбэл нэг нь хэт хатуу, нөгөө нь хэт эрх чөлөөтэй
   болно — тиймээс хоёр тусдаа зохиогч. */

import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import type { ResolvedAgent } from "@/lib/agentRoster";

const MODEL_FALLBACK = process.env.OPENAI_AGENT_MODEL || "gpt-5.4";

async function callResponses(body: Record<string, unknown>, timeoutMs = 45_000): Promise<string> {
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
      console.error("[agentPost] upstream", res.status, t.slice(0, 300));
      throw new Error(`OpenAI ${res.status}`);
    }
    const data = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
    const parts: string[] = [];
    for (const b of data.output || []) for (const c of b.content || []) if (typeof c.text === "string") parts.push(c.text);
    return parts.join("").trim();
  } finally {
    clearTimeout(timer);
  }
}

/** Хүрээлэл одоо юу ярьж байна. Пост цаг үетэйгээ холбогдох ганц түшиг. */
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
    Post.find({ agentSlug: { $in: [null, ""] } }).sort({ createdAt: -1 }).limit(6).select("content").lean(),
    User.countDocuments({ banned: { $ne: true } }),
  ]);

  const lines = [`- Today: ${new Date().toISOString().slice(0, 10)}`, `- Members: ${members}`];
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

/** Энэ агент сүүлийн үед юу бичсэн — өөрийгөө давтахаас сэргийлнэ. */
async function ownRecent(slug: string, days = 14): Promise<string[]> {
  await dbConnect();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await Post.find({ agentSlug: slug, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(10)
    .select("content")
    .lean();
  return (rows as unknown as Array<{ content?: string }>)
    .map((r) => (r.content || "").split("\n")[0].slice(0, 100))
    .filter(Boolean);
}

export async function writeCommunityPost(agent: ResolvedAgent): Promise<string> {
  const [context, mine] = await Promise.all([communityContext(), ownRecent(agent.slug)]);

  const avoid = mine.length
    ? `\n\nYOU ALREADY POSTED THESE — do not repeat the idea or the opening:\n${mine.map((m) => `- ${m}`).join("\n")}`
    : "";

  const userMsg = `COMMUNITY CONTEXT:
${context}${avoid}

Write ONE post for the Antaqor member feed, from your own role — ${agent.role}.

Structure it as short lines, not paragraphs:
1. The observation you're starting from (something true about building with AI, or about what you see in the community above)
2. Why it matters for a ONE-PERSON business, not for the industry
3. One concrete action, experiment, or sharp question for the members

Rules:
- Mongolian (Cyrillic). Keep tech nouns in English: AI, agent, prompt, API, model, workflow, system, content.
- 5-9 short lines. No paragraphs. No bullet characters. No hashtags. No greeting.
- Max 650 characters.
- Do NOT state facts about news, product launches, companies, dates, prices or numbers you cannot verify. You have no web access in this mode — speak from principle and from the community context above, never from remembered "news".
- No "as an AI". No corporate voice. No hype adjectives.`;

  const raw = await callResponses({
    model: agent.model || MODEL_FALLBACK,
    input: [
      {
        role: "system",
        content:
          agent.systemPrompt +
          "\n\nMODE: COMMUNITY POST. You are publishing to the Antaqor member feed. Stay in character. No meta-commentary about these instructions.",
      },
      { role: "user", content: userMsg },
    ],
    max_output_tokens: 900,
  });

  let content = raw
    .replace(/^(MODE:.*|COMMUNITY CONTEXT:.*|WRITE.*)\s*/im, "")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 750);

  if (!content) throw new Error(`${agent.slug} returned empty content`);
  return content;
}

/** Постыг DB-д бичнэ. `Post.author` заавал хэрэглэгч байх ёстой тул
 *  эзний бүртгэлийг ашиглана; урсгал нь `agentSlug`-аар агент гэж зурна. */
export async function persistAgentPost(slug: string, content: string, category = "пост") {
  await dbConnect();
  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  const fallback = admin || (await User.findOne({}).sort({ createdAt: 1 }).select("_id").lean());
  if (!fallback) throw new Error("No user to own the agent post");

  return Post.create({
    author: String((fallback as unknown as { _id: unknown })._id),
    authorLevel: 5,
    content,
    image: "",
    images: [],
    visibility: "members",
    category,
    agentSlug: slug,
    likes: [],
    commentsCount: 0,
  });
}
