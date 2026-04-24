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

  const h = size === "md" ? "h-9" : "h-7";
  const padX = size === "md" ? "px-3.5" : "px-2.5";
  const text = size === "md" ? "text-[12px]" : "text-[11px]";

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => doShare("native")}
        disabled={busy}
        className={`group inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] ${padX} ${h} font-semibold text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58] disabled:opacity-50 ${text}`}
        aria-label="Хуваалцаж кредит олох"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        {flash || "Хуваалц"}
        {!flash && session?.user && (
          <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-1.5 py-0.5 text-[9px] font-black text-[#EF2C58]">
            +3
          </span>
        )}
      </button>
    </div>
  );
}
