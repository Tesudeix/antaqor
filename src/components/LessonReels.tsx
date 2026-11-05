"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { track, trackOnce } from "@/lib/analytics";

interface ReelItem {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  requiredPlan: string;
  locked: boolean;
  kind: "locked" | "youtube" | "file";
  youtubeId: string | null;
  videoUrl: string | null;
  thumbnail: string;
  durationSec: number;
  completed: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "STARTER",
  builder: "BUILDER",
  operator: "OPERATOR",
};

// ─── Reel-based lessons: swipe хийгээд л сур ───
// Free хичээлүүд эхэндээ; plan-аас дээш контент locked slide болж яг тухайн
// plan руу шилжүүлнэ (classroom-той ижил server-side gating).
export default function LessonReels() {
  const router = useRouter();
  const { status } = useSession();
  const [items, setItems] = useState<ReelItem[] | null>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackOnce("reels_view");
    if (status !== "authenticated") return;
    fetch("/api/classroom/reels")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [status]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !items?.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.index);
            if (Number.isFinite(idx)) setActive(idx);
          }
        }
      },
      { root: container, threshold: 0.6 }
    );
    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items?.length]);

  const markComplete = useCallback(async (lesson: ReelItem) => {
    if (lesson.completed) return;
    try {
      const res = await fetch(`/api/classroom/lessons/${lesson.id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        track("reel_lesson_completed", { lesson: lesson.id });
        setItems((prev) =>
          prev ? prev.map((l) => (l.id === lesson.id ? { ...l, completed: true } : l)) : prev
        );
      }
    } catch {
      // network hiccup — user can tap the button again
    }
  }, []);

  // ── Guest gate ──
  if (status === "unauthenticated") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#0A0A0A] px-6 text-center">
        <div className="chrome mb-3 text-[10px] text-[#2E29FF]">ANTAQOR // REEL ХИЧЭЭЛ</div>
        <h1 className="headline mb-3 text-[26px]">Скролл хийгээд л сур</h1>
        <p className="mb-8 max-w-sm text-[14px] leading-relaxed text-[#E2E4E8]">
          60 секундын богино хичээлүүд — reel үзэх шиг амархан. Үнэгүй бүртгүүлээд
          эхний хичээлүүдээ одоо үз.
        </p>
        <Link
          href="/auth/signup"
          onClick={() => track("free_signup_clicked", { source: "reels_gate" })}
          className="bg-[#2E29FF] px-8 py-4 text-[14px] font-bold text-white transition hover:bg-[#1F1AD9]"
        >
          Нэгдэх
        </Link>
        <Link href="/auth/signin" className="mt-4 text-[13px] text-[#E2E4E8] underline underline-offset-4">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black text-[#E2E4E8]">
        Ачаалж байна…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      {/* top chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4">
        <button
          onClick={() => router.push("/")}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center bg-black/50 text-white"
          aria-label="Буцах"
        >
          ←
        </button>
        <span className="chrome text-[10px] text-[#2E29FF]">REEL ХИЧЭЭЛ</span>
        <span className="chrome text-[10px] text-[#E2E4E8]">
          {items.length ? `${Math.min(active + 1, items.length)}/${items.length}` : ""}
        </span>
      </div>

      <div ref={containerRef} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-[#E2E4E8]">
            <p>Одоогоор reel хичээл алга.</p>
            <Link href="/classroom" className="text-[#F2F2F4] underline underline-offset-4">
              Курсууд руу очих →
            </Link>
          </div>
        )}
        {items.map((item, i) => (
          <section key={item.id} data-index={i} className="relative h-full w-full snap-start snap-always">
            {item.kind === "locked" ? (
              <LockedReel item={item} />
            ) : (
              <>
                {item.kind === "youtube" && item.youtubeId ? (
                  i === active ? (
                    <iframe
                      key={item.id}
                      src={`https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${item.youtubeId}&rel=0&modestbranding=1`}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 h-full w-full"
                      title={item.title}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#101013]">
                      <span className="text-4xl opacity-40">▶</span>
                    </div>
                  )
                ) : (
                  <FileReel
                    item={item}
                    active={i === active}
                    muted={muted}
                    onToggleMute={() => setMuted((m) => !m)}
                    onNinetyPercent={() => void markComplete(item)}
                  />
                )}

                {/* bottom overlay */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-6 pt-16">
                  <div className="chrome mb-1.5 text-[11px] text-[#E2E4E8]">
                    {item.courseTitle.toUpperCase()}
                  </div>
                  <h2 className="mb-3 text-[16px] font-bold text-white">{item.title}</h2>
                  <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void markComplete(item)}
                      disabled={item.completed}
                      className={`px-4 py-2.5 text-[12px] font-bold transition ${
                        item.completed
                          ? "bg-[#1f2b22] text-green-400"
                          : "bg-[#2E29FF] text-white hover:bg-[#1F1AD9]"
                      }`}
                    >
                      {item.completed ? "✓ Дууссан" : "Хичээл дуусгасан ✓"}
                    </button>
                    <Link
                      href={`/classroom/course/${item.courseId}`}
                      className="border border-white/25 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white backdrop-blur"
                    >
                      Курс нээх →
                    </Link>
                  </div>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function LockedReel({ item }: { item: ReelItem }) {
  const plan = PLAN_LABEL[item.requiredPlan] ?? item.requiredPlan.toUpperCase();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#131316] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center bg-[#141414] bg-black/60 text-3xl">
        🔒
      </div>
      <div className="chrome mt-5 text-[10px] text-[#E2E4E8]">{item.courseTitle.toUpperCase()}</div>
      <h2 className="headline mt-2 text-[20px]">{item.title}</h2>
      <p className="mt-2 max-w-xs text-[13px] text-[#E2E4E8]">
        Энэ хичээл <span className="font-bold text-[#2E29FF]">{plan}</span> plan-аар нээгдэнэ.
      </p>
      <Link
        href={`/pricing?plan=${item.requiredPlan}`}
        onClick={() => track("upgrade_prompt_viewed", { source: "reels", plan: item.requiredPlan })}
        className="mt-6 bg-[#2E29FF] px-8 py-3.5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9]"
      >
        {plan} болох →
      </Link>
      <Link href="/classroom" className="mt-4 text-[12px] text-[#E2E4E8] underline underline-offset-4">
        Хөтөлбөр үзэх
      </Link>
    </div>
  );
}

function FileReel({
  item,
  active,
  muted,
  onToggleMute,
  onNinetyPercent,
}: {
  item: ReelItem;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onNinetyPercent: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) void v.play().catch(() => undefined);
    else v.pause();
  }, [active]);

  return (
    <div className="absolute inset-0 bg-black" onClick={onToggleMute}>
      <video
        ref={videoRef}
        src={item.videoUrl ?? undefined}
        muted={muted}
        playsInline
        loop
        className="h-full w-full object-cover"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0) {
            setPct((v.currentTime / v.duration) * 100);
            if (!firedRef.current && v.currentTime / v.duration > 0.9) {
              firedRef.current = true;
              onNinetyPercent();
            }
          }
        }}
      />
      {muted && active && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2 bg-black/60 px-3 py-1.5 text-xs text-white">
          🔇 Дуу нээх бол товш
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 z-10 h-[3px] bg-white/10">
        <div className="h-full bg-[#2E29FF]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
