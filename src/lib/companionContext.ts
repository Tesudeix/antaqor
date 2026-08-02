// Live platform context for Antaqor's prompt: latest news, top courses,
// admin-curated facts. Cached in-memory for ~60s so chat turns don't hammer
// the DB on every message.

import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import Course from "@/models/Course";
import Lesson from "@/models/Lesson";
import Post from "@/models/Post";
import User from "@/models/User";
import CompanionKnowledge from "@/models/CompanionKnowledge";

interface NewsBrief { title: string; slug: string; excerpt: string }
interface CourseBrief { title: string; id: string; lessonsCount: number }
interface FactBrief { topic: string; content: string }

export interface PlatformStats {
  totalUsers: number;
  activeMembers: number;
  totalCourses: number;
  totalLessons: number;
  totalCommunityPosts: number;
}

export interface PlatformContext {
  news: NewsBrief[];
  courses: CourseBrief[];
  facts: FactBrief[];
  stats: PlatformStats;
  loadedAt: number;
}

let cache: PlatformContext | null = null;
const TTL_MS = 60_000;

export async function getPlatformContext(): Promise<PlatformContext> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache;

  await dbConnect();
  const [
    newsDocs,
    courseDocs,
    factDocs,
    totalUsers,
    activeMembers,
    totalCourses,
    totalLessons,
    totalCommunityPosts,
  ] = await Promise.all([
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
    // estimatedDocumentCount uses metadata — instant, no scan
    User.estimatedDocumentCount(),
    User.countDocuments({
      clan: "antaqor",
      subscriptionExpiresAt: { $gt: new Date() },
    }),
    Course.estimatedDocumentCount(),
    Lesson.estimatedDocumentCount(),
    Post.countDocuments({ image: { $exists: true, $ne: "" } }),
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
    stats: {
      totalUsers,
      activeMembers,
      totalCourses,
      totalLessons,
      totalCommunityPosts,
    },
    loadedAt: now,
  };
  return cache;
}

export function invalidatePlatformContext() {
  cache = null;
}

export function buildPlatformContextBlock(ctx: PlatformContext): string {
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

— LIVE ТООН ҮЗҮҮЛЭЛТ (хэрэглэгч "хэр их гишүүнтэй / хичээлтэй" гэх мэт асуувал ҮНЭН тоог хэлээрэй) —
• Бүртгэлтэй хэрэглэгч: ${ctx.stats.totalUsers.toLocaleString()}
• Идэвхтэй гишүүн (төлбөртэй, хугацаа дуусаагүй): ${ctx.stats.activeMembers.toLocaleString()}
• Нийт курс: ${ctx.stats.totalCourses.toLocaleString()}
• Нийт хичээл: ${ctx.stats.totalLessons.toLocaleString()}
• Community-д хуваалцсан зурагтай пост: ${ctx.stats.totalCommunityPosts.toLocaleString()}

— ШИНЭ МЭДЭЭ —
${newsLines}

— ИДЭВХТЭЙ КУРСУУД —
${courseLines}
${factLines ? `\n— АДМИНААС НЭМСЭН ОНЦЛОГ МЭДЭЭЛЭЛ —\n${factLines}` : ""}

ДҮРЭМ:
- Тоонуудыг яг буцаа. "Ойролцоогоор" "магадгүй" битгий хэл — энэ мэдээлэл live.
- Тоо хариулсныхаа дараа богино тайлбар нэмж болно (жнь "сүүлийн 30 хоногт +X нэмэгдсэн" гэх мэт сэтгэгдэл — бүгдийг нэмэх албагүй).`;
}
