import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import Event from "@/models/Event";
import Course from "@/models/Course";

export const metadata: Metadata = {
  title: "Танилцах",
  description:
    "AI мэдээ, хичээл, эвент, хэрэгслүүд — Antaqor дахь бүх контент нэг дор.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Танилцах · ANTAQOR",
    description: "AI мэдээ, хичээл, эвент, хэрэгслүүд — бүгд нэг дор.",
    url: "/explore",
    images: ["/opengraph-image"],
  },
};

function formatEventDate(d: Date): string {
  const day = d.getDate();
  const months = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];
  return `${months[d.getMonth()]} ${day}`;
}

interface TileProps {
  href: string;
  accent: string;
  icon: string;
  eyebrow: string;
  title: string;
  subtitle: string;
}

function SectionHeader({ accent, eyebrow, href, action = "Бүгдийг үзэх" }: { accent: string; eyebrow: string; href: string; action?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-[2px] w-4" style={{ background: accent }} />
        <span className="text-[11px] font-bold tracking-[0.2em] text-[#E8E8E8]">{eyebrow}</span>
      </div>
      <Link href={href} className="text-[11px] font-bold text-[#666] transition hover:text-[#EF2C58]">
        {action} →
      </Link>
    </div>
  );
}

function JumpChips() {
  const chips: { href: string; label: string; color: string }[] = [
    { href: "#blog", label: "Блог", color: "#EF2C58" },
    { href: "#events", label: "Хуваарь", color: "#EF2C58" },
    { href: "#courses", label: "Хичээл", color: "#A855F7" },
    { href: "#tools", label: "Хэрэгсэл", color: "#06B6D4" },
  ];
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
      <div className="flex items-center gap-1.5 pb-1">
        {chips.map((c) => (
          <a
            key={c.href}
            href={c.href}
            className="shrink-0 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] px-3.5 py-1.5 text-[12px] font-semibold text-[#AAA] transition hover:text-[#E8E8E8]"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: c.color }} />
            {c.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ToolTile({ href, accent, icon, eyebrow, title, subtitle }: TileProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-5 transition hover:border-[rgba(239,44,88,0.25)]"
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[4px]"
        style={{ background: `${accent}1F` }}
      >
        <svg className="h-5 w-5" fill="none" stroke={accent} strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div className="mt-4 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: accent }}>
        {eyebrow}
      </div>
      <div className="mt-1 text-[15px] font-bold leading-tight text-[#E8E8E8]">{title}</div>
      <div className="mt-1 text-[11px] text-[#666]">{subtitle}</div>
      <svg className="absolute right-4 top-4 h-4 w-4 text-[#333] transition group-hover:text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
    </Link>
  );
}

export default async function ExplorePage() {
  await dbConnect();

  const [newsRaw, eventsRaw, coursesRaw] = await Promise.all([
    News.find({ published: true }).sort({ featured: -1, publishedAt: -1 }).limit(4).select("-content").lean(),
    Event.find({ status: { $in: ["upcoming", "live"] } }).sort({ date: 1 }).limit(3).lean(),
    Course.find().sort({ order: 1 }).limit(4).lean(),
  ]);

  type RawNews = { _id: { toString(): string }; title: string; slug: string; excerpt?: string; coverImage?: string; category: string; publishedAt: Date; readingMinutes?: number };
  const news = (newsRaw as unknown as RawNews[]).map((n) => ({
    _id: n._id.toString(),
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt || "",
    coverImage: n.coverImage || "",
    category: n.category,
    publishedAt: new Date(n.publishedAt),
    readingMinutes: n.readingMinutes || 1,
  }));

  type RawEvent = { _id: { toString(): string }; title: string; description?: string; image?: string; date: Date; type: string; status: string; color?: string };
  const events = (eventsRaw as unknown as RawEvent[]).map((e) => ({
    _id: e._id.toString(),
    title: e.title,
    description: e.description || "",
    image: e.image || "",
    date: new Date(e.date),
    type: e.type,
    status: e.status,
    color: e.color || "#EF2C58",
  }));

  type RawCourse = { _id: { toString(): string }; title: string; description?: string; thumbnail?: string; lessonsCount?: number; requiredLevel?: number };
  const courses = (coursesRaw as unknown as RawCourse[]).map((c) => ({
    _id: c._id.toString(),
    title: c.title,
    description: c.description || "",
    thumbnail: c.thumbnail || "",
    lessonsCount: c.lessonsCount || 0,
    requiredLevel: c.requiredLevel || 0,
  }));

  const categoryColor: Record<string, string> = {
    AI: "#EF2C58",
    LLM: "#A855F7",
    Agents: "#EF2C58",
    Research: "#3B82F6",
    "Бизнес": "#F59E0B",
    Tool: "#06B6D4",
    "Монгол": "#EC4899",
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      {/* Hero */}
      <section className="pt-1">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-5 bg-[#EF2C58]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-[#EF2C58]">EXPLORE</span>
        </div>
        <h1 className="mt-2.5 text-[28px] font-black leading-[1.05] tracking-tight text-[#E8E8E8] md:text-[40px]">
          Танилцах
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#666] md:text-[14px]">
          AI мэдээ, хичээл, эвент, хэрэгслүүд — Antaqor дахь бүх контент нэг дор.
        </p>
        <div className="mt-4">
          <JumpChips />
        </div>
      </section>

      {/* ─── BLOG ─── */}
      <section id="blog" className="scroll-mt-20">
        <SectionHeader accent="#EF2C58" eyebrow="AI МЭДЭЭ · БЛОГ" href="/news" />
        {news.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] py-10 text-center text-[12px] text-[#555]">
            Мэдээ удахгүй
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {news.map((n, i) => {
              const color = categoryColor[n.category] || "#EF2C58";
              return (
                <Link
                  key={n._id}
                  href={`/news/${n.slug}`}
                  className="group flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(239,44,88,0.25)]"
                >
                  <div className="relative aspect-[16/10] bg-[#1A1A1A]">
                    {n.coverImage ? (
                      <img src={n.coverImage} alt={n.title} loading={i < 2 ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                        <span className="text-[9px] tracking-[0.3em] text-[#2A2A2A]">ANTAQOR</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ background: `${color}F2`, color: "#fff" }}>
                      {n.category}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[#E8E8E8] transition-colors group-hover:text-white">
                      {n.title}
                    </h3>
                    <div className="mt-auto pt-2 text-[10px] text-[#555]">{n.readingMinutes} мин унших</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── EVENTS ─── */}
      <section id="events" className="scroll-mt-20">
        <SectionHeader accent="#EF2C58" eyebrow="ХУВААРЬ · ЭВЕНТ" href="/calendar" />
        {events.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] py-10 text-center text-[12px] text-[#555]">
            Ойрын эвент алга
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {events.map((e) => {
              const isLive = e.status === "live";
              return (
                <Link
                  key={e._id}
                  href="/calendar"
                  className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(239,44,88,0.25)]"
                >
                  <div className="relative aspect-[16/10] bg-[#1A1A1A]">
                    {e.image ? (
                      <img src={e.image} alt={e.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                        <svg className="h-10 w-10 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" /></svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {isLive && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-[#EF2C58] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                        LIVE
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 rounded-[4px] bg-black/60 px-2 py-1 backdrop-blur">
                      <div className="text-[11px] font-black text-white leading-none">{formatEventDate(e.date)}</div>
                      <div className="mt-0.5 text-[9px] text-white/70 leading-none">
                        {e.date.getHours().toString().padStart(2, "0")}:{e.date.getMinutes().toString().padStart(2, "0")}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[#EF2C58]">
                      {e.type}
                    </div>
                    <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[#E8E8E8]">{e.title}</h3>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── COURSES ─── */}
      <section id="courses" className="scroll-mt-20">
        <SectionHeader accent="#A855F7" eyebrow="ХИЧЭЭЛ · СУРГАЛТ" href="/classroom" />
        {courses.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[rgba(255,255,255,0.06)] bg-[#0D0D0D] py-10 text-center text-[12px] text-[#555]">
            Хичээл удахгүй нэмэгдэнэ
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((c) => (
              <Link
                key={c._id}
                href={`/classroom/course/${c._id}`}
                className="group overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] transition hover:border-[rgba(168,85,247,0.25)]"
              >
                <div className="relative aspect-[16/10] bg-[#1A1A1A]">
                  {c.thumbnail ? (
                    <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[rgba(168,85,247,0.08)] to-[#0D0D0D]">
                      <svg className="h-10 w-10 text-[#A855F7]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#A855F7]">
                    <span>{c.lessonsCount} хичээл</span>
                    {c.requiredLevel > 0 && (
                      <>
                        <span className="text-[#2A2A2A]">·</span>
                        <span>Lv {c.requiredLevel}+</span>
                      </>
                    )}
                  </div>
                  <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[#E8E8E8]">{c.title}</h3>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#666]">{c.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ─── TOOLS ─── */}
      <section id="tools" className="scroll-mt-20">
        <SectionHeader accent="#06B6D4" eyebrow="ХЭРЭГСЭЛ · ҮЙЛЧИЛГЭЭ" href="/services" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolTile
            href="/tools/youtube-mp3"
            accent="#06B6D4"
            icon="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            eyebrow="TOOL"
            title="YouTube → MP3"
            subtitle="YouTube бичлэгийг дуу болгон татах"
          />
          <ToolTile
            href="/services"
            accent="#F59E0B"
            icon="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
            eyebrow="БҮХ ҮЙЛЧИЛГЭЭ"
            title="Үйлчилгээ"
            subtitle="Antaqor-н нэмэлт сервисүүд"
          />
          <ToolTile
            href="/credits"
            accent="#EF2C58"
            icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            eyebrow="REFERRAL"
            title="Кредит ба Урилга"
            subtitle="Найзаа урьж кредитээр гишүүнчлэл авах"
          />
        </div>
      </section>

      {/* ─── Final CTA for guests ─── */}
      <section className="overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0D0D0D] to-[#0D0D0D] p-6 md:p-8">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-[#EF2C58]">ANTAQOR</div>
            <h3 className="mt-1.5 text-[20px] font-bold leading-tight text-[#E8E8E8] md:text-[22px]">
              AI бүтээгчдийн нийгэмлэг
            </h3>
            <p className="mt-1 text-[12px] text-[#666] md:text-[13px]">
              Промт, агент, бизнес — Cyber Empire-ийн дотоод контентод хандах эрх.
            </p>
          </div>
          <Link href="/auth/signup" className="rounded-[4px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]">
            Нэгдэх →
          </Link>
        </div>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
