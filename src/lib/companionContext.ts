// Live platform context for Antaqor's prompt: latest news, top courses,
// admin-curated facts. Cached in-memory for ~60s so chat turns don't hammer
// the DB on every message.

import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import Course from "@/models/Course";
import CompanionKnowledge from "@/models/CompanionKnowledge";

interface NewsBrief { title: string; slug: string; excerpt: string }
interface CourseBrief { title: string; id: string; lessonsCount: number }
interface FactBrief { topic: string; content: string }

export interface PlatformContext {
  news: NewsBrief[];
  courses: CourseBrief[];
  facts: FactBrief[];
  loadedAt: number;
}

let cache: PlatformContext | null = null;
const TTL_MS = 60_000;

export async function getPlatformContext(): Promise<PlatformContext> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache;

  await dbConnect();
  const [newsDocs, courseDocs, factDocs] = await Promise.all([
    News.find({ published: true })
      .sort({ publishedAt: -1 })
      .limit(4)
      .select("title slug excerpt")
      .lean(),
    Course.find()
      .sort({ lessonsCount: -1, createdAt: -1 })
      .limit(4)
      .select("_id title lessonsCount")
      .lean(),
    CompanionKnowledge.find({ active: true })
      .sort({ weight: -1, updatedAt: -1 })
      .limit(8)
      .select("topic content")
      .lean(),
  ]);

  cache = {
    news: newsDocs.map((n) => ({
      title: String((n as { title?: string }).title || ""),
      slug: String((n as { slug?: string }).slug || ""),
      excerpt: String((n as { excerpt?: string }).excerpt || "").slice(0, 200),
    })),
    courses: courseDocs.map((c) => ({
      id: String((c as { _id?: unknown })._id || ""),
      title: String((c as { title?: string }).title || ""),
      lessonsCount: Number((c as { lessonsCount?: number }).lessonsCount || 0),
    })),
    facts: factDocs.map((f) => ({
      topic: String((f as { topic?: string }).topic || ""),
      content: String((f as { content?: string }).content || ""),
    })),
    loadedAt: now,
  };
  return cache;
}

export function invalidatePlatformContext() {
  cache = null;
}

export function buildPlatformContextBlock(ctx: PlatformContext): string {
  if (!ctx.news.length && !ctx.courses.length && !ctx.facts.length) {
    return "";
  }
  const newsLines = ctx.news.length
    ? ctx.news.map((n) => `• ${n.title}${n.excerpt ? ` — ${n.excerpt}` : ""} (link: /news/${n.slug})`).join("\n")
    : "(шинэ мэдээ алга)";
  const courseLines = ctx.courses.length
    ? ctx.courses.map((c) => `• ${c.title} — ${c.lessonsCount} хичээл (link: /classroom/course/${c.id})`).join("\n")
    : "(идэвхтэй курс алга)";
  const factLines = ctx.facts.length
    ? ctx.facts.map((f) => `• [${f.topic}] ${f.content}`).join("\n")
    : "";

  return `═══ LIVE PLATFORM CONTEXT — antaqor.com яг одоо ═══
Энэ мэдээллийг ашиглан хэрэглэгч асуухад тодорхой курс/мэдээ/үйлчилгээ зөвлөнө. Зөвхөн хамаатай үед, дурдахдаа линкийг нь дурд.

ШИНЭ МЭДЭЭ:
${newsLines}

ИДЭВХТЭЙ КУРСУУД:
${courseLines}
${factLines ? `\nАДМИНААС НЭМСЭН ОНЦЛОГ МЭДЭЭЛЭЛ:\n${factLines}` : ""}`;
}
