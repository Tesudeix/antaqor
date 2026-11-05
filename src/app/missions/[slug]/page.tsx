"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import UpgradeModal from "@/components/UpgradeModal";
import { PLANS, type PlanId } from "@/lib/plans";
import { track } from "@/lib/analytics";

// ─── Mission detail — brief for everyone, execution for the right plan ───

interface Mission {
  _id: string;
  slug: string;
  title: string;
  brief: string;
  deliverable: string;
  skills: string[];
  requiredPlan: PlanId;
  xpReward: number;
  unlocked: boolean;
  instructions: string;
  mySubmission: { status: string; feedback: string } | null;
}

export default function MissionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: session } = useSession();
  const router = useRouter();

  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/missions")
      .then((r) => r.json())
      .then((d) => {
        const m = (d.missions || []).find((x: Mission) => x.slug === slug);
        setMission(m || null);
        if (m?.mySubmission) setSubmitted(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !mission) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/missions/${mission.slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "plan_required") setShowUpgrade(true);
        else setError(data.error || "Илгээж чадсангүй");
        return;
      }
      track("mission_submitted", { mission: mission.slug });
      if (mission.requiredPlan === "free") track("starter_mission_completed");
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }
  if (!mission) {
    return <div className="py-20 text-center text-[14px] text-[#E2E4E8]">Mission олдсонгүй</div>;
  }

  const planDef = PLANS[mission.requiredPlan];

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <Link href="/missions" className="chrome mb-6 inline-block text-[10px] text-[#E2E4E8] hover:text-[#F2F2F4]">
        ← БҮХ MISSION
      </Link>

      <div className="chrome mb-2 text-[10px]" style={{ color: mission.requiredPlan === "free" ? "#3B82F6" : planDef.accent }}>
        {mission.requiredPlan === "free" ? "STARTER MISSION · FREE" : `${planDef.name.toUpperCase()} PLAN`} · +{mission.xpReward} XP
      </div>
      <h1 className="headline mb-3 text-[clamp(22px,3.6vw,30px)]">{mission.title}</h1>
      <p className="mb-6 text-[14px] leading-relaxed text-[#E2E4E8]">{mission.brief}</p>

      <div className="mb-6 grid gap-px bg-[#262626] sm:grid-cols-2">
        <div className="bg-[#0A0A0A] p-4">
          <div className="chrome mb-1 text-[11px] text-[#E2E4E8]">DELIVERABLE</div>
          <div className="text-[13px] font-semibold text-[#F2F2F4]">{mission.deliverable}</div>
        </div>
        <div className="bg-[#0A0A0A] p-4">
          <div className="chrome mb-1 text-[11px] text-[#E2E4E8]">УР ЧАДВАР</div>
          <div className="text-[13px] text-[#F2F2F4]">{mission.skills.join(" · ")}</div>
        </div>
      </div>

      {mission.unlocked ? (
        <>
          {/* Full instructions */}
          <div className="mb-8 bg-[#141414] bg-[#0A0A0A] p-6">
            <div className="chrome mb-3 text-[11px] text-[#E2E4E8]">ЗААВАР</div>
            <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#F2F2F4]">
              {mission.instructions}
            </div>
          </div>

          {/* Submission */}
          {submitted ? (
            <div className="border border-green-500/30 bg-[#161c16] p-6 text-center">
              <div className="chrome mb-2 text-[10px] text-green-400">ИЛГЭЭСЭН ✓</div>
              <p className="mb-1 text-[14px] font-semibold text-[#F2F2F4]">Deliverable чинь хүлээн авагдлаа.</p>
              <p className="text-[12px] text-[#E2E4E8]">
                Feedback ирмэгц мэдэгдэл очно. Түр зуур дараагийн хичээлээ үргэлжлүүл.
              </p>
              {mission.mySubmission?.feedback && (
                <div className="mt-4 border-t border-[#262626] pt-4 text-left">
                  <div className="chrome mb-1 text-[11px] text-[#F59E0B]">FEEDBACK</div>
                  <p className="text-[13px] text-[#F2F2F4]">{mission.mySubmission.feedback}</p>
                </div>
              )}
              <Link href="/" className="chrome mt-5 inline-block text-[10px] text-[#E2E4E8] hover:text-[#F2F2F4]">
                DASHBOARD РУУ →
              </Link>
            </div>
          ) : session ? (
            <form onSubmit={submit} className="bg-[#141414] bg-[#0A0A0A] p-6">
              <div className="chrome mb-4 text-[11px] text-[#E2E4E8]">ҮР ДҮНГЭЭ ИЛГЭЭХ</div>
              <label className="chrome mb-1.5 block text-[11px] text-[#E2E4E8]">ЛИНК (LIVE URL)</label>
              <input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
                className="mb-4 w-full bg-[#141414] bg-[#0A0A0A] px-4 py-3 text-[14px] text-[#F2F2F4] outline-none placeholder:text-[#E2E4E8] focus:border-[#2E29FF]"
              />
              <label className="chrome mb-1.5 block text-[11px] text-[#E2E4E8]">ЮУ БҮТЭЭСЭН, ЯАЖ ХИЙСЭН</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Товч тайлбар…"
                className="mb-4 w-full bg-[#141414] bg-[#0A0A0A] px-4 py-3 text-[14px] text-[#F2F2F4] outline-none placeholder:text-[#E2E4E8] focus:border-[#2E29FF]"
              />
              {error && <div className="mb-4 text-[13px] text-[#2E29FF]">{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#2E29FF] py-3.5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-60"
              >
                {submitting ? "Илгээж байна…" : `Илгээх — +${mission.xpReward} XP`}
              </button>
            </form>
          ) : (
            <div className="bg-[#141414] bg-[#0A0A0A] p-6 text-center">
              <p className="mb-4 text-[13px] text-[#E2E4E8]">Илгээхийн тулд эхлээд нэгд.</p>
              <Link href="/auth/signup" className="inline-block bg-[#2E29FF] px-8 py-3.5 text-[13px] font-bold text-white">
                Нэгдэх
              </Link>
            </div>
          )}
        </>
      ) : (
        /* Locked — sell the unlock with exactly what they get */
        <div className="bg-[#141414] bg-[#0A0A0A] p-6">
          <div className="chrome mb-3 text-[10px]" style={{ color: planDef.accent }}>
            🔒 ЭНЭ MISSION-ИЙГ {planDef.name.toUpperCase()} PLAN-ААР НЭЭНЭ
          </div>
          <ul className="mb-5 space-y-2 text-[13px] text-[#F2F2F4]">
            {["Бүрэн mission заавар", "Template-ууд", "Submission эрх", "Community feedback"].map((b) => (
              <li key={b} className="flex items-center gap-2">
                <span className="h-[6px] w-[6px]" style={{ background: planDef.accent }} /> {b}
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              track("upgrade_prompt_viewed", { context: mission.title, source: "mission_detail" });
              if (session) setShowUpgrade(true);
              else router.push(`/auth/signup?plan=${mission.requiredPlan}`);
            }}
            className="w-full bg-[#2E29FF] py-3.5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            {planDef.name} plan нээх — {planDef.price.toLocaleString()}₮
          </button>
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal
          requiredPlan={mission.requiredPlan}
          contextTitle={mission.title}
          unlocks={["Бүрэн mission заавар", "Template-ууд", "Submission эрх", "Community feedback"]}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </main>
  );
}
