"use client";

import { useEffect } from "react";

/**
 * Admin-scoped error boundary.
 *
 * The app-wide boundary shows a generic "Something went wrong", which is fine
 * for a visitor but useless for the person who has to fix it: one legacy
 * document with a missing field takes a whole admin tab down and the screen
 * says nothing about which page, which field, or whether a reload would help.
 * This one names the failure and offers the two things that actually resolve
 * it — retry the render, or hard-reload when the tab is running stale JS after
 * a deploy.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] render error:", error);
  }, [error]);

  const stale = /server action|chunk|deployment/i.test(error?.message || "");

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <div className="rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[rgba(46,41,255,0.06)] p-6">
        <h2 className="text-[16px] font-bold text-[#E8E8E8]">
          {stale ? "Энэ таб хуучин хувилбар дээр ажиллаж байна" : "Энэ хуудсыг харуулахад алдаа гарлаа"}
        </h2>

        <p className="mt-2 text-[12px] text-[#E2E4E8]">
          {stale
            ? "Сервер шинэчлэгдсэн байна. Хатуу сэргээхэд засарна."
            : "Алдааны мэдээллийг доор бичив — засахад шууд хэрэг болно."}
        </p>

        {!stale && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-[4px] bg-[#0A0A0A] p-3 text-[11px] leading-relaxed text-[#4C47FF]">
            {error?.message || "Тодорхойгүй алдаа"}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={reset}
            className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#1E1E1E]"
          >
            Дахин оролдох
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-[4px] bg-[rgba(255,255,255,0.08)] px-4 py-2 text-[12px] font-bold text-[#E8E8E8] hover:bg-[rgba(255,255,255,0.14)]"
          >
            Хуудсыг сэргээх
          </button>
          <a
            href="/admin"
            className="rounded-[4px] px-4 py-2 text-[12px] text-[#E2E4E8] hover:text-[#E8E8E8]"
          >
            Админ нүүр
          </a>
        </div>
      </div>
    </div>
  );
}
