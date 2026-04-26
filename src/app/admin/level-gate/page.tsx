"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Settings {
  band: number;
  cap: number;
  multiplier: number;
  enabled: boolean;
  defaults: { feedLevelBand: number; freeLevelCap: number; paidXpMultiplier: number; levelGateEnabled: number };
}

export default function LevelGateAdminPage() {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [flash, setFlash] = useState("");

  const [band, setBand] = useState(2);
  const [cap, setCap] = useState(5);
  const [multiplier, setMultiplier] = useState(1.5);
  const [enabled, setEnabled] = useState(true);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2800);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/level-gate");
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setBand(d.band);
      setCap(d.cap);
      setMultiplier(d.multiplier);
      setEnabled(d.enabled);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/level-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ band, cap, multiplier, enabled }),
      });
      const d = await res.json();
      if (res.ok) {
        showFlash("Хадгалагдлаа · cache 30 сек-д синк болно");
        setData({ ...(data as Settings), ...d });
      } else {
        showFlash("Алдаа: " + (d.error || "failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const backfill = async () => {
    if (!confirm("Бүх постын authorLevel-ийг зохиогчийн одоогийн level-ээс шинэчлэх үү?")) return;
    setBackfilling(true);
    try {
      const res = await fetch("/api/admin/level-gate/backfill", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        showFlash(`Backfill: ${d.updated}/${d.processed} пост шинэчлэгдсэн`);
      } else {
        showFlash("Алдаа: " + (d.error || "failed"));
      }
    } finally {
      setBackfilling(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  const visibleBand = `L${Math.max(1, cap - band)}–${cap + band}`;

  return (
    <div className="space-y-5 pb-6">
      {flash && (
        <div className="fixed top-4 right-4 z-50 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2.5 text-[13px] text-[#E8E8E8] shadow-xl">
          {flash}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Level Gating</h1>
          <p className="mt-0.5 text-[12px] text-[#555]">Feed visibility band + free cap + paid XP multiplier</p>
        </div>
        <Link href="/" target="_blank" className="rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white">
          Feed харах
        </Link>
      </div>

      {/* Master toggle */}
      <div className="flex items-center justify-between rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div>
          <div className="text-[14px] font-bold text-[#E8E8E8]">Level gate ажиллаж байна</div>
          <div className="mt-0.5 text-[11px] text-[#666]">
            Идэвхгүй үед feed нь level-аас үл хамаарч өмнөх хэвээр ажиллана (kill-switch)
          </div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${enabled ? "bg-[#EF2C58]" : "bg-[#333]"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      {/* Sliders */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Band */}
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Feed band</div>
            <span className="text-[18px] font-black text-[#E8E8E8] tabular-nums">±{band}</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={band}
            onChange={(e) => setBand(Number(e.target.value))}
            className="w-full accent-[#EF2C58]"
          />
          <div className="mt-2 flex justify-between text-[9px] text-[#555]">
            <span>0 (exact)</span>
            <span>10 (loose)</span>
          </div>
          <div className="mt-3 text-[11px] text-[#666]">
            User at L{cap} sees: <span className="font-bold text-[#E8E8E8]">{visibleBand}</span>
          </div>
        </div>

        {/* Free cap */}
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Free cap</div>
            <span className="text-[18px] font-black text-[#E8E8E8] tabular-nums">L{cap}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={cap}
            onChange={(e) => setCap(Number(e.target.value))}
            className="w-full accent-[#EF2C58]"
          />
          <div className="mt-2 flex justify-between text-[9px] text-[#555]">
            <span>L1</span>
            <span>L20</span>
          </div>
          <div className="mt-3 text-[11px] text-[#666]">
            Free users can't progress past <span className="font-bold text-[#E8E8E8]">L{cap}</span> without paying
          </div>
        </div>

        {/* Multiplier */}
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Paid XP multiplier</div>
            <span className="text-[18px] font-black text-[#E8E8E8] tabular-nums">{multiplier.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="w-full accent-[#EF2C58]"
          />
          <div className="mt-2 flex justify-between text-[9px] text-[#555]">
            <span>1.0× (off)</span>
            <span>3.0× (aggressive)</span>
          </div>
          <div className="mt-3 text-[11px] text-[#666]">
            Paid members earn <span className="font-bold text-[#E8E8E8]">{multiplier.toFixed(1)}×</span> XP on every action
          </div>
        </div>
      </div>

      {/* Save + Backfill */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40"
        >
          {saving ? "..." : "Хадгалах"}
        </button>
        <button
          onClick={backfill}
          disabled={backfilling}
          className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-6 py-2.5 text-[13px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58] disabled:opacity-40"
        >
          {backfilling ? "Backfill... (том бол удна)" : "Постууд backfill-ах"}
        </button>
        <span className="text-[10px] text-[#555]">
          Backfill = бүх постын authorLevel-ийг зохиогчийн одоогийн level-ээс шинэчилнэ. Анх удаагаа заавал ажиллуулна.
        </span>
      </div>

      {/* Explainer */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-5 text-[12px] leading-relaxed text-[#888]">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">Яаж ажилладаг вэ?</div>
        <ol className="list-inside list-decimal space-y-1.5">
          <li>User-ийн <span className="font-bold text-[#CCC]">effective level</span> = paid бол actual level, free бол min(actual, free cap)</li>
          <li>Feed-д <span className="font-bold text-[#CCC]">visibility=members</span> постуудыг зөвхөн authorLevel нь [effLevel − band, effLevel + band] мужид байгаа бол харуулна</li>
          <li><span className="font-bold text-[#CCC]">visibility=free</span> болон blog/market нь ямагт public — level gate үл хамаарна</li>
          <li>Paid member бол бүх XP-д {multiplier.toFixed(1)}× multiplier орно → level хурдан өсөх</li>
          <li>Backfill дарахад бүх хуучин пост зохиогчийн одоогийн level-ээр stamp-гдана</li>
        </ol>
      </div>
    </div>
  );
}
