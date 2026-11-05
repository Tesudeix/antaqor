"use client";

import { REACTIONS, REACTION_ORDER, ReactionKey } from "@/lib/reactions";

export default function ReactionPicker({
  open,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  current: ReactionKey | null;
  onPick: (key: ReactionKey) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute bottom-full left-0 z-50 mb-2 flex items-center gap-1 rounded-[4px] border border-[#22222c] bg-[#f2f5f8] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
        onMouseLeave={onClose}
      >
        {REACTION_ORDER.map((key) => {
          const r = REACTIONS[key];
          const Icon = r.Icon;
          const active = current === key;
          return (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                onPick(key);
                onClose();
              }}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-[4px] transition-transform duration-150 hover:-translate-y-1 hover:scale-125 ${
                active ? "ring-2 ring-[#FFD300]/60 ring-offset-1 ring-offset-[#f2f5f8]" : ""
              }`}
              aria-label={r.label}
            >
              <Icon size={28} />
              <span className="pointer-events-none absolute -top-7 whitespace-nowrap rounded-[4px] bg-[#0A0A0A] px-1.5 py-0.5 text-[10px] font-medium text-[#e8e6e1] opacity-0 transition group-hover:opacity-100">
                {r.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
