"use client";

import { useEffect, useState } from "react";

/* ─── "Сайт засвартай байна" ───
   Two stages, on purpose:

     1. ON ARRIVAL — a full-screen notice. You cannot miss it, which is the
        point: a thin strip at the top is the first thing a visitor's eye
        learns to skip.
     2. AFTER "Үргэлжлүүлэх" — it collapses to a slim bar that stays for the
        rest of the session, so the site never silently forgets it warned you.

   It is still a NOTICE and not a gate. The site, sign-in, payments and the
   Founding page all keep working behind it — the overlay is dismissible by
   design. Making it a hard lock is a one-line change (see ALLOW_DISMISS),
   but locking a commercial site out of its own checkout is a decision for a
   human to make deliberately, not a side effect of wording.

   `lastKnown` in localStorage is what makes it feel instant: a returning
   visitor gets the overlay on the FIRST paint instead of after the fetch
   lands, and the fetch then corrects it either way. */

const ALLOW_DISMISS = true;
const LS_KEY = "antaqorMaintenance";
const SS_KEY = "antaqorMaintenanceSeen";

export default function MaintenanceBanner() {
  const [state, setState] = useState<{ on: boolean; text: string } | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // First paint: trust the last known answer so there is no blank moment.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(LS_KEY);
      if (cached) setState(JSON.parse(cached));
      if (sessionStorage.getItem(SS_KEY) === "1") setCollapsed(true);
    } catch { /* private mode — fall through to the fetch */ }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/maintenance")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const next = { on: !!d.on, text: String(d.text || "") };
        setState(next);
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!state?.on) return null;

  const dismiss = () => {
    setCollapsed(true);
    try { sessionStorage.setItem(SS_KEY, "1"); } catch { /* ignore */ }
  };

  // ── stage 2: the slim reminder ──
  if (collapsed) {
    return (
      <div
        role="status"
        className="sticky top-0 z-[70] flex items-center justify-center gap-3 bg-[#d9a441] px-4 py-2.5"
      >
        <span className="h-2 w-2 flex-none animate-pulse rounded-full bg-[#0e1726]" />
        <span className="text-[12.5px] font-semibold leading-snug text-[#0e1726] md:text-[13px]">
          {state.text}
        </span>
      </div>
    );
  }

  // ── stage 1: the arrival notice ──
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Сайт засвартай байна"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-[#0b0d12]/97 px-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg text-center">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#d9a441]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d9a441]">
            ANTAQOR · SYSTEM
          </span>
        </div>

        <h1 className="mb-5 text-[22px] md:text-[34px] font-black leading-[1.05] tracking-tight text-white md:text-[26px] md:text-[46px]">
          Сайт засвартай<br />байна.
        </h1>

        <p className="mx-auto mb-8 max-w-md text-[14px] leading-relaxed text-[#9aa3af] md:text-[15px]">
          {state.text}
        </p>

        {ALLOW_DISMISS && (
          <button
            type="button"
            onClick={dismiss}
            autoFocus
            className="w-full bg-[#d9a441] px-6 py-3.5 text-[13px] font-black uppercase tracking-wider text-[#0e1726] transition hover:brightness-110 sm:w-auto sm:px-10"
          >
            Ойлголоо · Үргэлжлүүлэх →
          </button>
        )}

        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#E2E4E8]">
          Худалдан авалт, нэвтрэлт хэвийн ажиллаж байна
        </p>
      </div>
    </div>
  );
}
