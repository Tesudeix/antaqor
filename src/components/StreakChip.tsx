"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";

interface StreakState {
  streakDays: number;
  streakBestDays: number;
}

export default function StreakChip() {
  const { data: session, status } = useSession();
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [toast, setToast] = useState<{ days: number; label: string; credits: number; xp: number } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;

    // Fire the daily check-in (idempotent per calendar day)
    const check = async () => {
      try {
        // Only hit the endpoint once per day per device
        const today = new Date().toISOString().slice(0, 10);
        const lastLocal = typeof window !== "undefined" ? localStorage.getItem("antaqor:streakCheckedOn") : null;
        if (lastLocal === today && streak) return;

        const res = await fetch("/api/streak", { method: "POST" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStreak({ streakDays: data.streakDays || 0, streakBestDays: data.streakBestDays || 0 });
        localStorage.setItem("antaqor:streakCheckedOn", today);

        if (data.milestoneReached) {
          setToast({
            days: data.streakDays,
            label: data.milestoneLabel || "",
            credits: data.creditsAwarded || 0,
            xp: data.xpAwarded || 0,
          });
        }
      } catch {
        /* ignore */
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!session?.user || !streak || streak.streakDays <= 0) return null;

  const flame = streak.streakDays >= 100 ? "🏆" : streak.streakDays >= 30 ? "⚡" : streak.streakDays >= 7 ? "🔥" : "🔥";

  return (
    <>
      <Link
        href={`/profile/${(session.user as { id?: string })?.id || ""}`}
        title={`Streak: ${streak.streakDays} өдөр дараалан · дээд амжилт ${streak.streakBestDays}`}
        className="group inline-flex items-center gap-1 rounded-[4px] border border-[rgba(249,115,22,0.25)] bg-[rgba(249,115,22,0.06)] px-2 py-1 text-[12px] font-bold text-[#F97316] transition hover:bg-[rgba(249,115,22,0.12)]"
      >
        <span className="text-[14px] leading-none">{flame}</span>
        <span className="tabular-nums">{streak.streakDays}</span>
      </Link>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-3 top-3 z-[80] mx-auto max-w-md"
          >
            <div className="relative overflow-hidden rounded-[4px] border border-[rgba(249,115,22,0.4)] bg-gradient-to-br from-[rgba(249,115,22,0.15)] via-[#111] to-[#0D0D0D] p-4 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-30"
                style={{ background: "radial-gradient(circle, #F97316AA, transparent 70%)" }}
              />
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-[24px] shadow-[0_0_32px_rgba(249,115,22,0.5)]">
                  🔥
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#F97316]">STREAK · {toast.days} ӨДӨР</div>
                  <div className="text-[14px] font-black text-[#E8E8E8]">{toast.label}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold">
                    <span className="text-[#EF2C58]">+{toast.credits} credit</span>
                    {toast.xp > 0 && <span className="text-[#A855F7]">+{toast.xp} XP</span>}
                  </div>
                </div>
                <button onClick={() => setToast(null)} className="h-6 w-6 shrink-0 rounded-full text-[#666] hover:text-[#AAA]">×</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
