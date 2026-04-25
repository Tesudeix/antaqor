"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface Props {
  kind: "post" | "news";
  resourceId: string;
  path: string;                // canonical path e.g. /news/gpt-55 or /posts/abc
  title?: string;
  excerpt?: string;
  referralCode?: string | null; // optional — if null, we fetch it lazily
  className?: string;
  size?: "sm" | "md";
}

function buildShareUrl(path: string, code: string | null): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://antaqor.com";
  const base = `${origin}${path}`;
  if (!code) return base;
  const joiner = path.includes("?") ? "&" : "?";
  return `${base}${joiner}ref=${encodeURIComponent(code)}&utm_source=share&utm_medium=member`;
}

export default function ShareButton({
  kind,
  resourceId,
  path,
  title,
  excerpt,
  referralCode,
  className = "",
  size = "sm",
}: Props) {
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string>("");
  const [code, setCode] = useState<string | null>(referralCode || null);

  const resolveCode = async (): Promise<string | null> => {
    if (code) return code;
    if (!session?.user) return null;
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) return null;
      const data = await res.json();
      if (data.referralCode) {
        setCode(data.referralCode);
        return data.referralCode;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  const doShare = async (channel: "native" | "copy") => {
    if (busy) return;
    setBusy(true);
    try {
      const referral = await resolveCode();
      const url = buildShareUrl(path, referral);

      let shared = false;
      if (channel === "native" && typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: title || "Antaqor",
            text: excerpt || "",
            url,
          });
          shared = true;
        } catch {
          shared = false;
        }
      }

      if (!shared) {
        try {
          await navigator.clipboard.writeText(url);
          setFlash("Холбоос хуулагдлаа");
        } catch {
          setFlash("Хуулж чадсангүй");
          return;
        }
      }

      // Report to server for credit reward (only if logged in)
      if (session?.user) {
        const res = await fetch("/api/credits/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, resourceId, channel: shared ? "native" : "copy" }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.awarded > 0) {
          setFlash(`+${data.awarded} кредит · Баярлалаа!`);
        } else if (data?.capped) {
          setFlash("Өнөөдрийн хязгаар хүрлээ");
        } else if (!flash) {
          setFlash(shared ? "Хуваалцлаа" : "Холбоос хуулагдлаа");
        }
      }
    } finally {
      setTimeout(() => setFlash(""), 2400);
      setBusy(false);
    }
  };

  const dim = size === "md" ? "h-9 w-9" : "h-7 w-7";
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => doShare("native")}
        disabled={busy}
        title={flash || "Хуваалцах"}
        aria-label={flash || "Хуваалцаж кредит олох"}
        className={`group inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] ${dim} text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58] disabled:opacity-50`}
      >
        {/* Refined share-arrow icon (square + outgoing arrow) — clearer than the abstract dots */}
        <svg className={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 8l4-4m0 0h-5m5 0v5M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
        </svg>
      </button>
      {flash && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1A1A1A] px-2 py-0.5 text-[10px] font-bold text-[#EF2C58] shadow-lg">
          {flash}
        </span>
      )}
    </div>
  );
}
