"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { upgradeTarget, formatMNT, type PlanId } from "@/lib/plans";
import { track } from "@/lib/analytics";

// ─── Upgrade modal — shown at moments of demonstrated intent ───
// Locked lesson / mission / feature opens this with the plan that unlocks it
// and a concrete list of what the user gets immediately.

export default function UpgradeModal({
  requiredPlan,
  contextTitle,
  unlocks,
  onClose,
}: {
  requiredPlan: PlanId;
  contextTitle: string; // e.g. "AI контент систем курс"
  unlocks?: string[]; // immediate benefits; defaults to plan benefits
  onClose: () => void;
}) {
  const router = useRouter();
  const plan = upgradeTarget(requiredPlan);
  const items = unlocks && unlocks.length > 0 ? unlocks : plan.benefits.slice(0, 4);

  useEffect(() => {
    track("upgrade_prompt_viewed", { plan: plan.id, context: contextTitle });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#141414] bg-[#0A0A0A] p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chrome mb-2 text-[10px]" style={{ color: plan.accent }}>
          {plan.name.toUpperCase()} PLAN // ШААРДЛАГАТАЙ
        </div>
        <h3 className="headline mb-2 text-[20px] leading-snug">
          {contextTitle}-г {plan.name} plan-аар нээнэ
        </h3>
        <p className="mb-5 text-[13px] text-[#E2E4E8]">{plan.tagline}</p>

        <div className="chrome mb-2 text-[11px] text-[#E2E4E8]">ШУУД НЭЭГДЭХ ЗҮЙЛС</div>
        <ul className="mb-6 space-y-2">
          {items.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[13px] leading-snug text-[#F2F2F4]">
              <span className="mt-[4px] h-[6px] w-[6px] shrink-0" style={{ background: plan.accent }} />
              {b}
            </li>
          ))}
        </ul>

        <button
          onClick={() => {
            track(`${plan.id}_plan_selected`, { source: "upgrade_modal", context: contextTitle });
            router.push(`/pricing?plan=${plan.id}`);
          }}
          className="w-full bg-[#2E29FF] py-4 text-[14px] font-bold text-white transition hover:bg-[#1F1AD9]"
        >
          {plan.name} plan нээх — {formatMNT(plan.price)}
        </button>
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-[12px] text-[#E2E4E8] transition hover:text-[#F2F2F4]"
        >
          Дараа
        </button>
      </div>
    </div>
  );
}
