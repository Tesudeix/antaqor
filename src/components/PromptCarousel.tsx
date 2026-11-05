"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track, trackOnce } from "@/lib/analytics";
import { CreditIcon } from "@/components/CreditIcon";

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
    coverImage?: string;
    category?: string;
    tags?: string[];
    creditPrice?: number;
    copiesCount: number;
    slides: Slide[];
  };
  viewerPlan: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  image: "ЗУРАГ",
  video: "ВИДЕО",
  text: "ТЕКСТ",
  business: "БИЗНЕС",
  code: "КОД",
  other: "БУСАД",
};

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
  const [buying, setBuying] = useState(false);
  const [buyErr, setBuyErr] = useState("");
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
        <p className="text-[14px] text-[#E2E4E8]">Багц олдсонгүй.</p>
        <Link href="/prompts" className="chrome mt-4 text-[11px] text-[#2E29FF]">
          ← PROMPT САН
        </Link>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="mx-auto min-h-[70vh] w-full max-w-2xl px-4 pt-16">
        <div className="h-5 w-40 animate-pulse bg-[#0A0A0A]" />
        <div className="mt-4 h-72 w-full animate-pulse bg-[#0A0A0A]" />
      </main>
    );
  }

  const { post } = data;
  const price = Number(post.creditPrice || 0);
  const unlocked = Boolean((data as { unlocked?: boolean }).unlocked);
  const signedIn = Boolean((data as { signedIn?: boolean }).signedIn);
  const planLabel = PLAN_LABEL[post.requiredPlan] ?? "";

  async function unlock() {
    if (buying) return;
    setBuying(true);
    setBuyErr("");
    try {
      const r = await fetch(`/api/prompts/${slug}/unlock`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 401 means "sign in first" — send them there rather than showing an
        // error they cannot act on.
        if (r.status === 401) { window.location.href = "/auth/signin"; return; }
        setBuyErr(d.error || "Нээхэд алдаа гарлаа.");
        return;
      }
      // Re-fetch rather than patching state: the server owns which slides are
      // open, and guessing here is how a locked prompt leaks.
      window.location.reload();
    } finally {
      setBuying(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-8">
      {post.coverImage && (
        /* 1.91:1 — the same crop the share card uses, so the page and the link
           preview show the identical image. */
        <div className="mb-5 -mx-4 overflow-hidden sm:mx-0">
          <img
            src={post.coverImage}
            alt={post.title}
            className="aspect-[1.91/1] w-full object-cover"
          />
        </div>
      )}

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/prompts" className="chrome text-[10px] text-[#E2E4E8] hover:text-[#F2F2F4]">
            ← PROMPT САН
          </Link>
          <h1 className="headline mt-2 text-[24px]">{post.title}</h1>
          <p className="mt-1 text-[13px] text-[#E2E4E8]">{post.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {post.category && (
              <span className="bg-[#1E1E1E] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">
                {CATEGORY_LABEL[post.category] ?? post.category}
              </span>
            )}
            {unlocked && (
              <span className="bg-[rgba(74,222,128,0.12)] px-2 py-1 text-[10px] font-bold text-[#4ADE80]">
                ✓ НЭЭГДСЭН
              </span>
            )}
            {!unlocked && price > 0 && (
              <span className="bg-[rgba(46,41,255,0.12)] px-2 py-1 text-[10px] font-bold text-[#2E29FF]">
                <CreditIcon size={10} className="mr-0.5" />{price} — бүрэн нээх
              </span>
            )}
            {(post.tags || []).slice(0, 3).map((t) => (
              <span key={t} className="px-2 py-1 text-[10px] text-[#E2E4E8]">#{t}</span>
            ))}
          </div>
        </div>
        <button
          onClick={share}
          className="shrink-0 bg-[#1E1E1E] px-4 py-2.5 text-[12px] font-bold text-[#F2F2F4] transition hover:border-[#2E29FF] hover:text-[#2E29FF]"
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
            className="flex w-[86%] shrink-0 snap-center flex-col bg-[#141414] bg-[#0A0A0A] p-5"
          >
            <div className="chrome mb-3 flex items-center justify-between text-[11px] text-[#E2E4E8]">
              <span>
                {String(i + 1).padStart(2, "0")} / {String(post.slides.length).padStart(2, "0")}
              </span>
              {s.locked && <span className="text-[#2E29FF]">🔒 {planLabel}</span>}
            </div>
            {s.title && <div className="mb-2 text-[15px] font-bold text-[#F2F2F4]">{s.title}</div>}
            {s.locked ? (
              <div className="flex flex-1 flex-col items-start justify-center py-6">
                <p className="text-[13px] leading-relaxed text-[#E2E4E8]">
                  Энэ prompt <b className="text-[#2E29FF]">{planLabel}</b> plan-аар нээгдэнэ.
                  {price > 0 && " Эсвэл зөвхөн энэ багцыг креditээр аваарай."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {price > 0 && (
                    <button
                      onClick={unlock}
                      disabled={buying}
                      className="bg-[#2E29FF] px-6 py-3 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
                    >
                      {buying ? "Нээж байна…" : signedIn ? <><CreditIcon size={11} className="mr-1" />{price}-ээр нээх</> : "Нэвтэрч нээх"}
                    </button>
                  )}
                  <Link
                    href={`/pricing?plan=${post.requiredPlan}`}
                    onClick={() => track("upgrade_prompt_viewed", { source: "prompts", plan: post.requiredPlan })}
                    className={`px-6 py-3 text-[13px] font-bold transition ${
                      price > 0
                        ? "bg-[#1E1E1E] text-[#F2F2F4] hover:text-[#2E29FF]"
                        : "bg-[#2E29FF] text-white hover:bg-[#1F1AD9]"
                    }`}
                  >
                    {planLabel} болох →
                  </Link>
                </div>
                {buyErr && <p className="mt-2 text-[12px] text-[#2E29FF]">{buyErr}</p>}
              </div>
            ) : (
              <>
                <pre className="flex-1 whitespace-pre-wrap break-words bg-[#141414] bg-[#0A0A0A] p-4 font-mono text-[12.5px] leading-relaxed text-[#F2F2F4]">
                  {s.prompt}
                </pre>
                <button
                  onClick={() => copy(i, s.prompt ?? "")}
                  className={`mt-3 w-full py-3.5 text-[13px] font-bold transition ${
                    copied === i
                      ? "bg-green-600 text-white"
                      : "bg-[#2E29FF] text-white hover:bg-[#1F1AD9]"
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
              i === active ? "bg-[#2E29FF]" : s.locked ? "bg-[#3a2026]" : "bg-[#262626]"
            }`}
          />
        ))}
      </div>
      <p className="chrome mt-3 text-center text-[11px] text-[#E2E4E8]">
        ХАЖУУ ТИЙШ ГҮЙЛГЭЖ ДАРААГИЙН PROMPT
      </p>
    </main>
  );
}
