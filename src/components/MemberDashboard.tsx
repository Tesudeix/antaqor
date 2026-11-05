"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS, type PlanId } from "@/lib/plans";
import JourneyBoard from "@/components/JourneyBoard";

// ─── Нэвтэрсэн нүүр — 7 хоногийн аялал гол нь. ───
// Дараалал: Тавтай морил → JourneyBoard (одоо хийх / countdown / 7 өдөр / явц)
// → community pulse + шууд линкүүд. Нэг дэлгэц, нэг гол үйлдэл.

interface DashData {
  user: { name: string; plan: PlanId; level: number; xp: number; streakDays: number; onboarded: boolean };
  course: { lessonsDone: number } | null;
  posts: { _id: string; content: string; category: string; createdAt: string; author: { name: string; avatar: string } | null }[];
}

function statusLevel(level: number): string {
  if (level >= 15) return "ARCHITECT";
  if (level >= 10) return "OPERATOR";
  if (level >= 5) return "BUILDER";
  return "EXPLORER";
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "сая";
  if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ц`;
  return `${Math.floor(h / 24)}ө`;
}

export default function MemberDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashData | null>(null);
  const [stats, setStats] = useState<{ seatsTotal?: number; seatsLeft?: number; newMembers?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    fetch("/api/users/me/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d?.user) {
          setData(d);
          // Onboarding-оо алгассан шинэ хэрэглэгчийг нэг удаа чиглүүлнэ.
          if (!d.user.onboarded && d.course && d.course.lessonsDone === 0) {
            router.replace("/onboarding");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
        <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }
  if (!data) return null;

  const { user, posts } = data;
  const firstName = (user.name || "").trim().split(" ")[0];

  return (
    <main className="w-full pb-24">
      {/* ── Hero — нэвтрээгүй нүүртэй яг ижил (өндөр, full-bleed) ── */}

      <div className="mx-auto w-full max-w-6xl pt-6">
      {/* ── Цомхон мэндчилгээ — level/streak нь [03]-т байгаа тул давхардуулахгүй ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="chrome flex items-center gap-2 text-[11px] font-bold">
            <span className="text-[#2E29FF]">DASHBOARD</span>
          </div>
          <h1 className="headline mt-1 text-[clamp(18px,2.8vw,24px)]">
            {firstName ? `Тавтай морил, ${firstName}` : "Тавтай морил"}
          </h1>
        </div>
        <span
          className="chrome rounded-[4px] border px-3 py-1.5 text-[11px] font-bold"
          style={{ borderColor: PLANS[user.plan].accent + "55", color: PLANS[user.plan].accent }}
        >
          {PLANS[user.plan].name.toUpperCase()}
        </span>
      </div>

      {/* ── 7 хоногийн аялал — гол хэсэг ── */}
      <JourneyBoard />

      {/* ── Хоёрдогч: community + шууд линкүүд ── */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section aria-label="Community" className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="chrome flex items-center gap-2 text-[11px] font-bold">
              <span className="text-[#2E29FF]">04</span>
              <span className="text-[#E2E4E8]">COMMUNITY</span>
            </div>
            <Link href="/feed" className="chrome text-[11px] font-bold text-[#2E29FF] hover:brightness-110">
              FEED →
            </Link>
          </div>
          <div className="space-y-3">
            {posts.length === 0 && <div className="text-[12px] text-[#E2E4E8]">Идэвх алга — эхнийхийг нь чи бич.</div>}
            {posts.map((p) => (
              <Link key={p._id} href="/feed" className="block border-b border-[#262626] pb-3 last:border-b-0 last:pb-0">
                <div className="mb-0.5 flex items-center gap-2 text-[11px] text-[#E2E4E8]">
                  <span className="font-semibold text-[#F2F2F4]">{p.author?.name || "Гишүүн"}</span>
                  <span className="text-[#E2E4E8]">{timeAgo(p.createdAt)}</span>
                </div>
                <div className="line-clamp-2 text-[12px] leading-snug text-[#E2E4E8]">{p.content}</div>
              </Link>
            ))}
          </div>
        </section>

        <nav aria-label="Шууд линкүүд" className="grid grid-cols-2 content-start gap-px overflow-hidden rounded-[4px] bg-[#262626]">
          {[
            { href: "/classroom", label: "Курсууд" },
            { href: "/missions", label: "Mission" },
            { href: "/prompts", label: "Prompt сан" },
            { href: "/reels", label: "Reels" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="bg-[#0A0A0A] p-4 text-center text-[12px] font-semibold text-[#F2F2F4] transition hover:bg-[#0A0A0A] hover:text-[#2E29FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2E29FF]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      </div>
    </main>
  );
}
