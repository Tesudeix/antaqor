import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import HomepageCard from "@/models/HomepageCard";

// First-run seed — keeps the homepage non-broken before any admin edits.
// Same content as the prior in-page DEFAULTS so visual continuity is preserved.
const DEFAULTS = [
  { section: "ai_solution" as const, emoji: "🧠", title: "CEO AI",          desc: "Бизнесийн стратегийн агент",      href: "/agents/ceo",            order: 10 },
  { section: "ai_solution" as const, emoji: "📸", title: "Брэнд зураг",     desc: "Бүтээгдэхүүний фото үүсгэх",     href: "/tools/brand-shot",      order: 20 },
  { section: "ai_solution" as const, emoji: "🎨", title: "Зураг үүсгэх",    desc: "AI-аар зураг гаргах",            href: "/tools/generate-image",  order: 30 },
  { section: "ai_solution" as const, emoji: "✍️", title: "Контент бичих",   desc: "Пост, нийтлэл богино хугацаанд",  href: "/tools/compose",         order: 40 },
  { section: "ai_solution" as const, emoji: "🔗", title: "Бүтээгдэхүүн",    desc: "Линкээс бүтээгдэхүүн гарах",     href: "/tools/extract-product", order: 50 },
  { section: "ai_solution" as const, emoji: "🎵", title: "YouTube → MP3",   desc: "Видеоны аудио татах",            href: "/tools/youtube-mp3",     order: 60 },
  { section: "ai_solution" as const, emoji: "💬", title: "Буджаргал чат",   desc: "Монгол хэлээр AI ярилц",         href: "/chat",                  order: 70 },
  { section: "ai_solution" as const, emoji: "🤖", title: "Companion",       desc: "Хувийн AI хамтрагч",             href: "/companion",             order: 80 },
  { section: "resource"     as const, emoji: "📚", title: "Промт сан",      desc: "Бэлэн промтуудын цуглуулга",     href: "/posts?category=промт", order: 10 },
  { section: "resource"     as const, emoji: "🎓", title: "AI хичээл",      desc: "Алхам алхмаар суралцах",         href: "/classroom",             order: 20 },
  { section: "resource"     as const, emoji: "💡", title: "Заавар тусламж", desc: "Чат AI-аас асуу",                href: "/chat",                  order: 30 },
  { section: "resource"     as const, emoji: "📰", title: "Шинэ мэдээ",     desc: "AI салбарын мэдээлэл",          href: "/news",                  order: 40 },
];

async function ensureSeed() {
  const count = await HomepageCard.countDocuments({});
  if (count > 0) return;
  await HomepageCard.insertMany(DEFAULTS);
}

// GET — public list, optionally filtered by section
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    await ensureSeed();
    const section = req.nextUrl.searchParams.get("section");
    const adminView = req.nextUrl.searchParams.get("admin") === "1";
    const filter: Record<string, unknown> = adminView ? {} : { enabled: true };
    if (section) filter.section = section;
    const cards = await HomepageCard.find(filter).sort({ section: 1, order: 1 }).lean();
    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] });
  }
}

// POST — create a card (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    if (!body.section || !["ai_solution", "resource"].includes(body.section)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }
    if (!body.title || !body.href) {
      return NextResponse.json({ error: "title and href required" }, { status: 400 });
    }
    await dbConnect();
    const card = await HomepageCard.create({
      section: body.section,
      title: body.title,
      desc: body.desc || "",
      emoji: body.emoji || "✨",
      coverImage: body.coverImage || "",
      href: body.href,
      order: typeof body.order === "number" ? body.order : 100,
      enabled: body.enabled !== false,
    });
    return NextResponse.json({ card }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
