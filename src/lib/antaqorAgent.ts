import dbConnect from "@/lib/mongodb";
import MarketProduct from "@/models/MarketProduct";
import Course from "@/models/Course";
import TrendingPrompt from "@/models/TrendingPrompt";
import MetaSettings from "@/models/MetaSettings";
import { generateReply, ChatTurn } from "@/lib/metaAI";
import ThreadsToken from "@/models/ThreadsToken";
import { ThreadsAPI } from "@/lib/threads";

// The Antaqor agentic AI — fires on a brand mention across any connected page,
// grounded in LIVE platform data (market products, courses, trending prompts).

let _ctxCache = "";
let _ctxAt = 0;

export async function gatherAntaqorContext(): Promise<string> {
  if (_ctxAt && Date.now() - _ctxAt < 120_000) return _ctxCache;
  await dbConnect();
  const lines: string[] = [];
  try {
    const products = (await MarketProduct.find({}).sort({ createdAt: -1 }).limit(6).lean()) as unknown as Record<string, unknown>[];
    const items = products
      .map((p) => {
        const t = (p.title || p.name || "") as string;
        const price = p.price ? ` — ${p.price}₮` : "";
        return t ? `• ${t}${price}` : "";
      })
      .filter(Boolean);
    if (items.length) lines.push("Зах зээл / бүтээгдэхүүн:\n" + items.join("\n"));
  } catch {}
  try {
    const courses = (await Course.find({}).sort({ createdAt: -1 }).limit(5).lean()) as unknown as Record<string, unknown>[];
    const items = courses.map((c) => (c.title ? `• ${c.title as string}` : "")).filter(Boolean);
    if (items.length) lines.push("Хичээлүүд:\n" + items.join("\n"));
  } catch {}
  try {
    const prompts = (await TrendingPrompt.find({}).sort({ createdAt: -1 }).limit(5).lean()) as unknown as Record<string, unknown>[];
    const items = prompts
      .map((p) => {
        const t = (p.title || p.text || p.prompt || "") as string;
        return t ? `• ${t.slice(0, 70)}` : "";
      })
      .filter(Boolean);
    if (items.length) lines.push("Тренд промтууд:\n" + items.join("\n"));
  } catch {}
  try {
    const tok = await ThreadsToken.findOne({}).lean<{ accessToken?: string; threadsUserId?: string }>();
    if (tok?.accessToken && tok?.threadsUserId) {
      const api = new ThreadsAPI(tok.accessToken, tok.threadsUserId);
      const res = (await api.getThreads(5)) as { data?: { text?: string }[] };
      const posts = (res?.data || []).map((p) => p.text).filter((t): t is string => !!t).slice(0, 5);
      if (posts.length) lines.push("Antaqor-ийн сүүлийн Threads постууд:\n" + posts.map((t) => `• ${t.slice(0, 90)}`).join("\n"));
    }
  } catch {}
  _ctxCache = lines.join("\n\n").slice(0, 1600) || "antaqor.com — AI бүтээгчдийн платформ (зах зээл, хичээл, промт).";
  _ctxAt = Date.now();
  return _ctxCache;
}

export async function antaqorAgentReply(
  text: string,
  history: ChatTurn[],
  userContext: string
): Promise<string> {
  const settings = await MetaSettings.findOne({ singleton: "main" });
  const live = await gatherAntaqorContext();
  const ctx = `[ANTAQOR АГЕНТ — antaqor.com-ийн ухаалаг туслах. Доорх АМЬД платформ мэдээлэлд тулгуурлан богино, тодорхой, үйлдэлд хөтлөх хариу өг. Тохирох бол antaqor.com/market, antaqor.com/classroom линк санал болго.]

${live}

[Хэрэглэгчийн тухай]
${userContext}`.slice(0, 2500);
  const gen = await generateReply(text, settings, ctx, history);
  return gen.ok
    ? gen.text
    : settings?.fallbackMessage || "Сайн уу! Antaqor AI байна 👋 antaqor.com дээр AI зах зээл, хичээл, промт бий.";
}
