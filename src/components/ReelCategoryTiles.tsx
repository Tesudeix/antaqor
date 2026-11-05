"use client";

import { REEL_CATEGORIES } from "@/lib/reelCategories";

/* ─── Reel ангиллын хавтангууд — "Your lists" маяг (2026-10-06) ───────────
   Дугуйрсан дөрвөлжин хавтан, дээр нь дүрс, доор нь нэр. Сонгосон нь
   өргөлт хүрээтэй; дахин дарвал шүүлтүүр арилж "бүгд" болно. Урсгал болон
   профайл ХОЁУЛАА энэ нэг бүрэлдэхүүнийг ашиглана. */

const ICONS: Record<string, React.ReactNode> = {
  "танилцуулга": (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0z" fill="currentColor" />
  ),
  story: (
    <path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  ),
  mission: (
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="currentColor" />
  ),
  "viral-reel": (
    <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z" fill="currentColor" />
  ),
  effects: (
    <path
      d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"
      fill="currentColor"
    />
  ),
  styles: (
    <path
      d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.6-.4-1 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3zM7.5 12.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
      fill="currentColor"
    />
  ),
};

export default function ReelCategoryTiles({
  value,
  onChange,
  className = "",
}: {
  value: string | null;
  onChange: (slug: string | null) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2.5 ${className}`} role="group" aria-label="Reel ангилал">
      {REEL_CATEGORIES.map((c) => {
        const on = value === c.slug;
        return (
          <button
            key={c.slug}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : c.slug)}
            className="press flex h-[92px] w-[104px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[4px] text-[14px] font-semibold leading-tight transition"
            style={{
              background: "var(--nav-hover-bg, #F1F2F7)",
              color: "var(--nav-fg-strong, #FFFFFF)",
              boxShadow: on ? "inset 0 0 0 2px #2E29FF" : undefined,
            }}
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" style={{ color: "#2E29FF" }} aria-hidden>
              {ICONS[c.slug]}
            </svg>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
