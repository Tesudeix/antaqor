"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const HIDDEN_PREFIXES = ["/posts/new", "/auth", "/admin", "/chat"];

export default function PostFAB() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") return null;
  if (!session) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <Link
      href="/posts/new"
      aria-label="Пост үүсгэх"
      className="group fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-[6px] bg-[#EF2C58] text-white shadow-[0_10px_30px_rgba(239,44,88,0.45)] ring-1 ring-[rgba(255,255,255,0.1)] transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_14px_44px_rgba(239,44,88,0.6)] active:scale-95 bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] md:right-8 md:bottom-8 md:h-16 md:w-16"
    >
      <span
        className="pointer-events-none absolute inset-0 rounded-[6px] bg-[#EF2C58] opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-60"
        aria-hidden
      />
      <svg
        className="relative h-6 w-6 transition-transform duration-200 group-hover:rotate-90 md:h-7 md:w-7"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
    </Link>
  );
}
