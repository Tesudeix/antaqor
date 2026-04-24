"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { getLevelTitle } from "@/lib/xpClient";

// Detects when the current user levels up, shows a full-width celebration toast.
// Stored level persists in localStorage so refreshes don't re-fire.
// Polls /api/credits (cheap, already cached) every 60s — no new endpoint required.

const STORAGE_KEY = "antaqor:lastSeenLevel";

function levelColor(lvl: number): string {
  if (lvl >= 96) return "#F472B6";
  if (lvl >= 81) return "#FF4473";
  if (lvl >= 61) return "#A855F7";
  if (lvl >= 41) return "#EF2C58";
  if (lvl >= 26) return "#22C55E";
  if (lvl >= 16) return "#0F81CA";
  if (lvl >= 6) return "#3B82F6";
  return "#999999";
}

interface LevelSnapshot {
  level: number;
  isMember: boolean;
}

export default function LevelUpToast() {
  const { data: session, status } = useSession();
  const [snapshot, setSnapshot] = useState<LevelSnapshot | null>(null);
  const [toast, setToast] = useState<{ fromLevel: number; toLevel: number; isMember: boolean } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    const fetchLevel = async () => {
      try {
        const [credRes, memRes] = await Promise.all([
          fetch("/api/credits"),
          fetch("/api/clan/status"),
        ]);
        const credData = credRes.ok ? await credRes.json() : null;
        const memData = memRes.ok ? await memRes.json() : null;

        // credits endpoint doesn't return level; call /api/users/me-lite? Use credits.balance is no good.
        // Fallback: use the user doc through /api/users/[id]
        const userId = (session?.user as { id?: string } | undefined)?.id;
        if (!userId) return;

        const userRes = await fetch(`/api/users/${userId}`);
        const userData = userRes.ok ? await userRes.json() : null;
        if (!userData?.user) return;

        const nextLevel: number = userData.user.level || 1;
        const isMember = !!memData?.isMember;
        if (cancelled) return;

        // Reference client-bound credData briefly so linter keeps the call (balance not used here but endpoint is already warm-cached)
        void credData;

        const stored = Number(localStorage.getItem(STORAGE_KEY) || "0");
        // Prime on first run — don't fire for already-held level.
        if (!stored) {
          localStorage.setItem(STORAGE_KEY, String(nextLevel));
          setSnapshot({ level: nextLevel, isMember });
          return;
        }

        if (nextLevel > stored) {
          setToast({ fromLevel: stored, toLevel: nextLevel, isMember });
          localStorage.setItem(STORAGE_KEY, String(nextLevel));
        }
        setSnapshot({ level: nextLevel, isMember });
      } catch {
        /* ignore */
      }
    };

    fetchLevel();
    const t = setInterval(fetchLevel, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [status, session]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const color = levelColor(toast.toLevel);
  const title = getLevelTitle(toast.toLevel);
  // If free user, nudge toward multiplier upgrade. Skip if cap reached.
  const nudgeMultiplier = !toast.isMember && toast.toLevel < 5;
  const nudgeUnlockCap = !toast.isMember && toast.toLevel >= 5;

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.97 }}
          transition={{ type: "spring", damping: 18, stiffness: 200 }}
          className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md"
        >
          <div
            className="relative overflow-hidden rounded-[12px] border bg-gradient-to-br p-4 shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
            style={{
              borderColor: `${color}66`,
              backgroundImage: `linear-gradient(135deg, ${color}22, #111 40%, #0F0F0F)`,
            }}
          >
            {/* Sparkle flourish */}
            <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-30"
              style={{ background: `radial-gradient(circle, ${color}88, transparent 70%)` }}
            />

            <div className="relative flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[18px] font-black text-white shadow-lg"
                style={{ background: color, boxShadow: `0 0 32px ${color}66` }}
              >
                L{toast.toLevel}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color }}>
                  <span>LEVEL UP</span>
                  <span className="text-[#444]">·</span>
                  <span className="text-[#AAA]">L{toast.fromLevel} → L{toast.toLevel}</span>
                </div>
                <div className="mt-0.5 text-[15px] font-black leading-tight text-[#E8E8E8]">
                  {title.titleMN}
                </div>
                <div className="text-[11px] text-[#888]">Том ахиц! Тавтай морил.</div>
              </div>
              <button
                onClick={() => setToast(null)}
                aria-label="close"
                className="h-6 w-6 shrink-0 rounded-full text-[#666] transition hover:bg-white/5 hover:text-[#AAA]"
              >
                ×
              </button>
            </div>

            {(nudgeMultiplier || nudgeUnlockCap) && (
              <Link
                href="/clan?pay=1"
                onClick={() => setToast(null)}
                className="mt-3 flex items-center justify-between rounded-[8px] border border-[rgba(239,44,88,0.25)] bg-[rgba(239,44,88,0.08)] px-3 py-2 transition hover:bg-[rgba(239,44,88,0.14)]"
              >
                <div className="text-[11px] text-[#CCC]">
                  {nudgeUnlockCap ? (
                    <>Free cap L5 хүрлээ — <span className="font-bold text-[#EF2C58]">хязгаарыг тайлах</span></>
                  ) : (
                    <>1.5× XP-ээр <span className="font-bold text-[#EF2C58]">2 дахин хурдан</span> өс</>
                  )}
                </div>
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#EF2C58]">
                  ₮49k
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </span>
              </Link>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
