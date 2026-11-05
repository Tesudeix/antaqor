"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { PLANS, type PlanId } from "@/lib/plans";
import { track } from "@/lib/analytics";

// ─── Missions — the weekly execution engine ───
// Everyone sees the briefs; instructions + submission are plan-gated.

interface Mission {
  _id: string;
  slug: string;
  title: string;
  brief: string;
  deliverable: string;
  skills: string[];
  requiredPlan: PlanId;
  xpReward: number;
  weekOf: string | null;
  submissionsCount: number;
  unlocked: boolean;
  mySubmission: { status: string; feedback: string } | null;
}

export default function MissionsPage() {
  const { data: session } = useSession();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/missions")
      .then((r) => r.json())
      .then((d) => setMissions(d.missions || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <div className="chrome mb-1 text-[10px] text-[#2E29FF]">ДААЛГАВАР · ДОЛОО ХОНОГ БҮР</div>
      <h1 className="headline mb-2 text-[clamp(18px,2.8vw,24px)]">Build mission-ууд</h1>
      <p className="mb-8 max-w-lg text-[13px] text-[#E2E4E8]">
        Мэдлэг биш — нотолгоо. Mission бүр нэг бодит deliverable-тэй, илгээмэгц feedback авна.
      </p>

      <div className="space-y-4">
        {missions.map((m) => (
          <Link
            key={m._id}
            href={`/missions/${m.slug}`}
            className="block bg-[#141414] bg-[#0A0A0A] p-6 transition hover:border-[#F2F2F4]/40"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="chrome text-[11px]" style={{ color: m.requiredPlan === "free" ? "#3B82F6" : PLANS[m.requiredPlan].accent }}>
                {m.requiredPlan === "free" ? "STARTER MISSION · FREE" : `${PLANS[m.requiredPlan].name.toUpperCase()} PLAN`}
              </span>
              <span className="chrome text-[11px] text-[#E2E4E8]">+{m.xpReward} XP</span>
            </div>
            <div className="mb-1.5 text-[17px] font-bold text-[#F2F2F4]">{m.title}</div>
            <p className="mb-3 text-[13px] leading-relaxed text-[#E2E4E8]">{m.brief}</p>
            <div className="flex flex-wrap items-center gap-2">
              {m.skills.map((s) => (
                <span key={s} className="bg-[#141414] bg-[#0A0A0A] px-2.5 py-1 text-[10.5px] text-[#E2E4E8]">
                  {s}
                </span>
              ))}
              <span className="ml-auto chrome text-[11px] text-[#E2E4E8]">
                {m.mySubmission
                  ? m.mySubmission.status === "reviewed" ? "FEEDBACK ИРСЭН ✓" : "ИЛГЭЭСЭН ✓"
                  : m.unlocked ? "НЭЭЛТТЭЙ →" : "🔒 НЭЭХ →"}
              </span>
            </div>
          </Link>
        ))}
        {missions.length === 0 && (
          <div className="bg-[#141414] bg-[#0A0A0A] p-8 text-center text-[13px] text-[#E2E4E8]">
            Идэвхтэй mission алга — тун удахгүй.
          </div>
        )}
      </div>

      {!session && (
        <div className="mt-10 bg-[#141414] bg-[#0A0A0A] p-6 text-center">
          <p className="mb-4 text-[13px] text-[#E2E4E8]">Starter mission үнэгүй. Бүртгүүлээд шууд эхэл.</p>
          <Link
            href="/auth/signup"
            onClick={() => track("free_signup_clicked", { source: "missions" })}
            className="inline-block bg-[#2E29FF] px-8 py-3.5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            Нэгдэх
          </Link>
        </div>
      )}
    </main>
  );
}
