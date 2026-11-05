"use client";

import { useEffect, useState } from "react";

/**
 * Notices when the server has been redeployed under an open tab.
 *
 * A tab loaded before a deploy keeps requesting chunks and action ids that no
 * longer exist on the server; clicking around then throws
 * `Failed to find Server Action "…"` and the admin looks broken when nothing is
 * actually wrong. This watches the build id and offers a reload.
 *
 * It deliberately does NOT reload on its own — an admin may be halfway through
 * composing a broadcast or a trigger, and silently throwing that away to fix a
 * cosmetic staleness would be a worse bug than the one it solves.
 */
export default function DeployWatcher() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let mine = "";
    let cancelled = false;

    const check = async () => {
      try {
        const r = await fetch("/api/build-id", { cache: "no-store" });
        if (!r.ok) return;
        const { id } = (await r.json()) as { id?: string };
        if (!id || cancelled) return;
        if (!mine) { mine = id; return; }
        if (id !== mine) setStale(true);
      } catch {
        /* offline or a blip — say nothing */
      }
    };

    void check();
    const t = setInterval(check, 60_000);
    // Coming back to the tab is exactly when a stale build is about to bite.
    const onFocus = () => void check();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);

  if (!stale) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 rounded-[4px] border border-[rgba(251,191,36,0.5)] bg-[#141414] px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-[#E8E8E8]">
          🔄 Шинэ хувилбар гарлаа. Энэ таб хуучин кодоор ажиллаж байна.
        </span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-[4px] bg-[#FBBF24] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#f5b400]"
        >
          Сэргээх
        </button>
        <button
          onClick={() => setStale(false)}
          className="text-[11px] text-[#E2E4E8] hover:text-[#E8E8E8]"
        >
          Дараа
        </button>
      </div>
    </div>
  );
}
