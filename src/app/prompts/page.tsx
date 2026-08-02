"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackOnce } from "@/lib/analytics";

interface PromptCard {
  slug: string;
  title: string;
  description: string;
  requiredPlan: string;
  slideCount: number;
  freeSlides: number;
  copiesCount: number;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "RUNNER",
  builder: "NETRUNNER",
  operator: "EDGERUNNER",
};

// ─── Prompt сан — carousel багцуудын жагсаалт. Нэвтрэлт шаардлагагүй. ───
export default function PromptsPage() {
  const [posts, setPosts] = useState<PromptCard[] | null>(null);

  useEffect(() => {
    trackOnce("prompts_list_view");
    fetch("/api/prompts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .catch(() => setPosts([]));
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8">
      <div className="chrome mb-2 flex items-center gap-2 text-[9px] font-bold">
        <span className="text-[#1080CA]">[PROMPT]</span>
        <span className="text-[#1080CA]">/////</span>
        <span className="text-[#84848C]">ХУУЛААД Л АЖИЛЛУУЛ</span>
        <span className="hidden h-px flex-1 bg-[#2E2E33] md:block" />
      </div>
      <h1 className="headline mb-2 text-[clamp(24px,5vw,36px)]">Prompt сан</h1>
      <p className="mb-8 max-w-lg text-[14px] leading-relaxed text-[#B4B4BA]">
        Багц бүр дэс дараалалтай prompt-уудын carousel. Нээгээд, хуулаад, шууд ажилдаа хэрэглэ.
      </p>

      {posts === null && (
        <div className="grid gap-3 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-[4px] bg-[#1E1E21]" />
          ))}
        </div>
      )}
      {posts?.length === 0 && (
        <div className="rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] p-8 text-center">
          <p className="text-[13px] text-[#B4B4BA]">Багцууд тун удахгүй нэмэгдэнэ.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {(posts ?? []).map((p) => (
          <Link
            key={p.slug}
            href={`/prompts/${p.slug}`}
            className="group flex flex-col rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] p-5 transition hover:-translate-y-0.5 hover:border-[#1080CA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1080CA]"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="tag text-[8px]">{p.slideCount} PROMPT</span>
              {p.requiredPlan !== "free" && (
                <span className="chrome rounded-[4px] border border-[#3A3A40] px-2 py-1 text-[7px] font-bold text-[#84848C]">
                  🔒 {PLAN_LABEL[p.requiredPlan] || p.requiredPlan.toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-[16px] font-bold leading-snug text-[#FFFFFF] transition group-hover:text-[#1080CA]">
              {p.title}
            </h2>
            {p.description && (
              <p className="mt-1.5 line-clamp-2 flex-1 text-[13px] leading-snug text-[#B4B4BA]">{p.description}</p>
            )}
            <div
              className="chrome mt-4 flex items-center justify-between border-t border-[#2E2E33] pt-2.5 text-[8px] font-bold text-[#84848C]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <span>{p.copiesCount > 0 ? `${p.copiesCount} ХУУЛАЛТ` : `${p.freeSlides} ҮНЭГҮЙ СЛАЙД`}</span>
              <span className="text-[#1080CA]">НЭЭХ &gt;</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
