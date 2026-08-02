"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track, trackOnce } from "@/lib/analytics";

interface Slide {
  title: string;
  prompt: string | null;
  locked: boolean;
}

interface PostResponse {
  post: {
    slug: string;
    title: string;
    description: string;
    requiredPlan: string;
    freeSlides: number;
    copiesCount: number;
    slides: Slide[];
  };
  viewerPlan: string;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "STARTER",
  builder: "BUILDER",
  operator: "OPERATOR",
};

// ─── Carousel prompt viewer — нээгээд, хуулаад, share хийгээд л ───
export default function PromptCarousel({ slug }: { slug: string }) {
  const [data, setData] = useState<PostResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<number | null>(null);
  const [shared, setShared] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackOnce("prompt_post_view");
    fetch(`/api/prompts/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setMissing(true));
  }, [slug]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || !data) return;
    const onScroll = () => {
      const w = el.clientWidth;
      if (w > 0) setActive(Math.round(el.scrollLeft / (w * 0.86)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  const copy = async (i: number, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(i);
      setTimeout(() => setCopied(null), 1600);
      track("prompt_copied", { slug, slide: i + 1 });
      void fetch(`/api/prompts/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy" }),
      });
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  const share = async () => {
    const url = `https://antaqor.com/prompts/${slug}`;
    track("prompt_shared", { slug });
    void fetch(`/api/prompts/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "share" }),
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: data?.post.title, url });
        return;
      } catch {
        /* user canceled */
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShared(true);
    setTimeout(() => setShared(false), 1600);
  };

  if (missing) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center px-4 text-center">
        <p className="text-[14px] text-[#B4B4BA]">Багц олдсонгүй.</p>
        <Link href="/prompts" className="chrome mt-4 text-[11px] text-[#1080CA]">
          ← PROMPT САН
        </Link>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-4 pt-16">
        <div className="h-5 w-40 animate-pulse bg-[#1E1E21]" />
        <div className="mt-4 h-72 w-full animate-pulse bg-[#1E1E21]" />
      </main>
    );
  }

  const { post } = data;
  const planLabel = PLAN_LABEL[post.requiredPlan] ?? "";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/prompts" className="chrome text-[10px] text-[#84848C] hover:text-[#F2F2F4]">
            ← PROMPT САН
          </Link>
          <h1 className="headline mt-2 text-[24px]">{post.title}</h1>
          <p className="mt-1 text-[13px] text-[#B4B4BA]">{post.description}</p>
        </div>
        <button
          onClick={share}
          className="shrink-0 border border-[#3A3A40] px-4 py-2.5 text-[12px] font-bold text-[#F2F2F4] transition hover:border-[#1080CA] hover:text-[#1080CA]"
        >
          {shared ? "Линк хуулагдлаа ✓" : "Share ↗"}
        </button>
      </div>

      {/* Carousel */}
      <div
        ref={trackRef}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4"
      >
        {post.slides.map((s, i) => (
          <div
            key={i}
            className="flex w-[86%] shrink-0 snap-center flex-col border border-[#2E2E33] bg-[#1E1E21] p-5"
          >
            <div className="chrome mb-3 flex items-center justify-between text-[9px] text-[#84848C]">
              <span>
                {String(i + 1).padStart(2, "0")} / {String(post.slides.length).padStart(2, "0")}
              </span>
              {s.locked && <span className="text-[#1080CA]">🔒 {planLabel}</span>}
            </div>
            {s.title && <div className="mb-2 text-[15px] font-bold text-[#F2F2F4]">{s.title}</div>}
            {s.locked ? (
              <div className="flex flex-1 flex-col items-start justify-center py-6">
                <p className="text-[13px] leading-relaxed text-[#B4B4BA]">
                  Энэ prompt <b className="text-[#1080CA]">{planLabel}</b> plan-аар нээгдэнэ.
                </p>
                <Link
                  href={`/pricing?plan=${post.requiredPlan}`}
                  onClick={() => track("upgrade_prompt_viewed", { source: "prompts", plan: post.requiredPlan })}
                  className="mt-4 bg-[#1080CA] px-6 py-3 text-[13px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]"
                >
                  {planLabel} болох →
                </Link>
              </div>
            ) : (
              <>
                <pre className="flex-1 whitespace-pre-wrap break-words border border-[#2E2E33] bg-[#161618] p-4 font-mono text-[12.5px] leading-relaxed text-[#F2F2F4]">
                  {s.prompt}
                </pre>
                <button
                  onClick={() => copy(i, s.prompt ?? "")}
                  className={`mt-3 w-full py-3.5 text-[13px] font-bold transition ${
                    copied === i
                      ? "bg-green-600 text-white"
                      : "bg-[#1080CA] text-[#0E0E10] hover:bg-[#4FA8E8]"
                  }`}
                >
                  {copied === i ? "Хуулагдлаа ✓" : "Prompt хуулах"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {post.slides.map((s, i) => (
          <span
            key={i}
            className={`h-[3px] w-8 transition ${
              i === active ? "bg-[#1080CA]" : s.locked ? "bg-[#3a2026]" : "bg-[#2E2E33]"
            }`}
          />
        ))}
      </div>
      <p className="chrome mt-3 text-center text-[9px] text-[#84848C]">
        ХАЖУУ ТИЙШ ГҮЙЛГЭЖ ДАРААГИЙН PROMPT
      </p>
    </main>
  );
}
