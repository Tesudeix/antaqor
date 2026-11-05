"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { REACTIONS, REACTION_ORDER, ReactionKey } from "@/lib/reactions";

interface Reactor {
  _id: string;
  name: string;
  avatar?: string;
}

type ReactorMap = Record<ReactionKey, Reactor[]>;

export default function ReactionSheet({
  open,
  postId,
  initialTab,
  onClose,
}: {
  open: boolean;
  postId: string;
  initialTab: ReactionKey | "all";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ReactionKey | "all">(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  const [data, setData] = useState<ReactorMap | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset tab when parent passes a new initialTab
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setTab(initialTab);
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/posts/${postId}/reactors`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d.reactors || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totals: Record<ReactionKey, number> = {
    like: 0, love: 0, fire: 0, idea: 0, haha: 0, celebrate: 0,
  };
  let total = 0;
  if (data) {
    for (const k of REACTION_ORDER) {
      totals[k] = data[k]?.length || 0;
      total += totals[k];
    }
  }

  const visibleReactors: { user: Reactor; key: ReactionKey }[] = [];
  if (data) {
    if (tab === "all") {
      for (const k of REACTION_ORDER) {
        for (const user of data[k] || []) visibleReactors.push({ user, key: k });
      }
    } else {
      for (const user of data[tab] || []) visibleReactors.push({ user, key: tab });
    }
  }

  const tabs: { key: ReactionKey | "all"; label: string; count: number }[] = [
    { key: "all", label: "All", count: total },
    ...REACTION_ORDER.filter((k) => totals[k] > 0).map((k) => ({
      key: k as ReactionKey | "all",
      label: REACTIONS[k].label,
      count: totals[k],
    })),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-[4px] border border-[#22222c] bg-[#f2f5f8] sm:rounded-[4px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F2F2F4] px-4 py-3">
          <h3 className="text-[14px] font-semibold text-[#e8e6e1]">Reactions</h3>
          <button onClick={onClose} className="rounded-[4px] p-1 text-[#E2E4E8] hover:text-[#e8e6e1]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#F2F2F4] px-3 py-2">
          {tabs.map((t) => {
            const isReaction = t.key !== "all";
            const r = isReaction ? REACTIONS[t.key as ReactionKey] : null;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition ${
                  active
                    ? "bg-[#F2F2F4] text-[#e8e6e1]"
                    : "text-[#E2E4E8] hover:text-[#e8e6e1]"
                }`}
              >
                {r && <r.Icon size={16} />}
                <span>{t.label}</span>
                <span className={active ? "text-[#FFD300]" : "text-[#E2E4E8]"}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Reactor list */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
            </div>
          ) : visibleReactors.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-[#E2E4E8]">Хэн ч react хийгээгүй байна</p>
          ) : (
            visibleReactors.map(({ user, key }) => {
              const r = REACTIONS[key];
              const initials = user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <Link
                  key={`${key}-${user._id}`}
                  href={`/profile/${user._id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[#15151c]"
                >
                  <div className="relative">
                    {user.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#F2F2F4] text-[11px] font-bold text-[#E2E4E8]">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 rounded-[4px] ring-2 ring-[#f2f5f8]">
                      <r.Icon size={16} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#e8e6e1]">{user.name}</p>
                    <p className="text-[11px]" style={{ color: r.color }}>{r.label}</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
