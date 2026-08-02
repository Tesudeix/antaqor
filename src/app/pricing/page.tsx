"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { PLANS, PAID_PLANS, PLAN_RANK, formatMNT, annualPrice, isPaidPlanId, type PlanId, type PlanDef } from "@/lib/plans";
import { track, trackOnce } from "@/lib/analytics";

// ─── Bank transfer details (same account as the clan flow) ───
const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";

type Step = "pricing" | "payment" | "pending";

interface PaymentState {
  _id?: string;
  status?: "pending" | "paid" | "failed";
  referenceCode?: string;
  amount?: number;
  plan?: string;
}

// ─── Collapsible full comparison ───
const COMPARISON: { label: string; free: string; starter: string; builder: string; operator: string }[] = [
  { label: "Курсын сан", free: "Starter курс", starter: "Starter багц", builder: "Бүрэн core сан", operator: "Core + Advanced" },
  { label: "Mission", free: "1 starter mission", starter: "Долоо хоногт сонгосон", builder: "Бүх mission", operator: "Бүх + орлогын mission" },
  { label: "Template", free: "—", starter: "Суурь", builder: "Premium", operator: "Premium + систем" },
  { label: "Feedback", free: "—", starter: "—", builder: "Community feedback", operator: "Экспертийн шууд feedback" },
  { label: "Өрөөнүүд", free: "Нээлттэй community", starter: "Нээлттэй community", builder: "Builder-only өрөө", operator: "Хаалттай Operator өрөө" },
  { label: "Live session", free: "—", starter: "—", builder: "—", operator: "Сар бүр strategy + workshop" },
  { label: "Early access", free: "—", starter: "—", builder: "—", operator: "Шинэ курс, tool эрт" },
];

function PricingInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("pricing");
  const [payingPlan, setPayingPlan] = useState<PlanDef | null>(null);
  const [payment, setPayment] = useState<PaymentState>({});
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [myPlan, setMyPlan] = useState<PlanId>("free");
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    trackOnce("pricing_viewed");
  }, []);

  // Current plan of the logged-in user
  useEffect(() => {
    if (!session) return;
    fetch("/api/clan/status")
      .then((r) => r.json())
      .then((d) => { if (d?.plan) setMyPlan(d.plan as PlanId); })
      .catch(() => {});
  }, [session]);

  const startPayment = useCallback(async (plan: PlanDef) => {
    track(`${plan.id}_plan_selected`);
    if (!session) {
      router.push(`/auth/signup?plan=${plan.id}`);
      return;
    }
    setSubmitting(true);
    setPayingPlan(plan);
    try {
      const res = await fetch("/api/clan/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.id, period }),
      });
      const data = await res.json();
      if (data.paymentId) {
        setPayment({
          _id: data.paymentId,
          status: data.status,
          referenceCode: data.referenceCode,
          amount: data.amount,
          plan: data.plan,
        });
        track("payment_started", { plan: plan.id, amount: data.amount });
        if (data.hasReceipt) {
          setStep("pending");
          return;
        }

        // Wire is the default path: one plan click creates the pending payment
        // and immediately opens the secure hosted checkout. Manual transfer is
        // retained only as a fallback when Wire is unavailable.
        try {
          const wireRes = await fetch("/api/wire/checkout", { method: "POST" });
          const wireData = await wireRes.json();
          if (wireData.url) {
            track("wire_checkout_opened", { plan: plan.id });
            window.location.href = wireData.url;
            return;
          }
        } catch {
          /* show the bank-transfer fallback below */
        }
        setStep("payment");
      }
    } finally {
      setSubmitting(false);
    }
  }, [session, router]);

  // Deep link: /pricing?plan=builder auto-opens payment (used by upgrade modals)
  useEffect(() => {
    const p = searchParams.get("plan");
    if (p && isPaidPlanId(p) && !PLANS[p].comingSoon && step === "pricing" && !submitting && session) {
      startPayment(PLANS[p]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Poll payment status while pending
  useEffect(() => {
    if (step !== "pending") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/clan/payment-status");
        const data = await res.json();
        if (cancelled || !data.payment) return;
        setPayment((prev) => ({ ...prev, status: data.payment.status }));
        if (data.payment.status === "paid") {
          track("payment_completed", { plan: data.payment.plan, amount: data.payment.amount });
          setTimeout(() => router.push("/?upgraded=1"), 1500);
        }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [step, router]);

  // Returning from Wire hosted checkout (?wire=1): jump straight to pending.
  useEffect(() => {
    if (searchParams.get("wire") !== "1" || !session || step !== "pricing") return;
    (async () => {
      try {
        const res = await fetch("/api/clan/payment-status");
        const data = await res.json();
        if (data.payment && isPaidPlanId(data.payment.plan)) {
          setPayingPlan(PLANS[data.payment.plan as keyof typeof PLANS]);
          setPayment({ _id: "", status: data.payment.status, referenceCode: data.payment.referenceCode, amount: data.payment.amount, plan: data.payment.plan });
          setStep("pending");
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const [period, setPeriod] = useState<"month" | "year">("month");
  // Deep link: /pricing?period=year preselects annual billing (homepage toggle)
  useEffect(() => {
    if (searchParams.get("period") === "year") setPeriod("year");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [wireLoading, setWireLoading] = useState(false);
  const payWithWire = async () => {
    setWireLoading(true);
    track("wire_checkout_opened", { plan: payingPlan?.id });
    try {
      const res = await fetch("/api/wire/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      /* fall through to bank transfer */
    }
    setWireLoading(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  // ─── Payment step ───
  if (step === "payment" && payingPlan) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg px-4 pb-24 pt-10">
        <button onClick={() => setStep("pricing")} className="chrome mb-6 text-[11px] text-[#84848C] hover:text-[#F2F2F4]">
          ← Буцах
        </button>
        <div className="chrome mb-2 text-[11px] text-[#1080CA]">ТӨЛБӨР // {payingPlan.name.toUpperCase()}</div>
        <h1 className="headline mb-1 text-[26px]">Шилжүүлэг хийх</h1>
        <p className="mb-6 text-[13px] text-[#B4B4BA]">
          Доорх данс руу <b className="text-[#F2F2F4]">{formatMNT(payment.amount || payingPlan.price)}</b> шилжүүлээд гүйлгээний
          утга дээр <b className="text-[#F2F2F4]">лавлах кодоо</b> бичнэ. Баталгаажмагц контент шууд нээгдэнэ.
        </p>

        <button
          onClick={payWithWire}
          disabled={wireLoading}
          className="mb-2 w-full bg-[#1080CA] py-4 text-[14px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8] disabled:opacity-60"
        >
          {wireLoading ? "Түр хүлээнэ үү…" : "⚡ Шууд төлөх — QPay · Банкны апп"}
        </button>
        <div className="chrome mb-5 text-center text-[9px] text-[#84848C]">
          ТӨЛМӨГЦ ШУУД ИДЭВХЖИНЭ · WIRE ТӨЛБӨРИЙН СИСТЕМ
        </div>
        <a
          href="https://pay.wire.mn/link/plink_g657mchigxy7ojjmniu3iipsxm"
          target="_blank"
          rel="noreferrer"
          className="chrome -mt-3 mb-5 block text-center text-[9px] text-[#84848C] underline underline-offset-4 hover:text-[#F2F2F4]"
        >
          АЖИЛЛАХГҮЙ БОЛ ЛИНКЭЭР ТӨЛНӨ — ГҮЙЛГЭЭНИЙ УТГАД УТАСАА БИЧЭЭРЭЙ
        </a>
        <details className="mb-4 border border-[#2E2E33]">
          <summary className="chrome cursor-pointer list-none px-4 py-3 text-center text-[10px] text-[#84848C] transition hover:text-[#F2F2F4]">
            ЭСВЭЛ ДАНСААР ШИЛЖҮҮЛЭХ ▾
          </summary>
          <div className="px-3 pb-3">
        <div className="mb-4 border border-[#2E2E33] bg-[#1E1E21]">
          <BankRow label="Банк" value={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
          <BankRow label="Данс" value={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} mono />
          <BankRow label="Хүлээн авагч" value={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
          <BankRow label="Дүн" value={formatMNT(payment.amount || payingPlan.price)} field="amount" copyText={String(payment.amount || payingPlan.price)} copied={copied} onCopy={copyToClipboard} mono />
          <BankRow
            label="Гүйлгээний утга"
            value={payment.referenceCode || "—"}
            field="ref"
            copied={copied}
            onCopy={copyToClipboard}
            mono
            highlight
          />
        </div>
        <p className="mb-6 text-[12px] leading-relaxed text-[#84848C]">
          Лавлах код нь таны төлбөрийг автоматаар таних түлхүүр. Заавал гүйлгээний утга дээр бичээрэй.
        </p>

        <button
          onClick={() => setStep("pending")}
          className="w-full bg-[#1080CA] py-4 text-[14px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]"
        >
          Шилжүүлсэн — баталгаажуулах
        </button>
          </div>
        </details>
      </main>
    );
  }

  // ─── Pending step ───
  if (step === "pending" && payingPlan) {
    const paid = payment.status === "paid";
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center px-4 pt-20 text-center">
        <div className={`chrome mb-4 text-[11px] ${paid ? "text-green-400" : "text-[#F59E0B]"}`}>
          {paid ? "ИДЭВХЖЛЭЭ" : "ШАЛГАЖ БАЙНА"}
        </div>
        <h1 className="headline mb-3 text-[26px]">
          {paid ? `${payingPlan.name} нээгдлээ 🎉` : "Төлбөрийг шалгаж байна"}
        </h1>
        <p className="mb-8 max-w-sm text-[13px] leading-relaxed text-[#B4B4BA]">
          {paid
            ? "Контент нээгдлээ. Dashboard руу шилжиж байна…"
            : `Шилжүүлэг ихэвчлэн хэдхэн минутад баталгаажна. Лавлах код: ${payment.referenceCode || "—"}. Энэ хуудсыг хааж болно — баталгаажмагц мэдэгдэл очно.`}
        </p>
        {!paid && (
          <div className="h-1 w-48 overflow-hidden bg-[#2E2E33]">
            <div className="h-full w-1/3 animate-pulse bg-[#1080CA]" />
          </div>
        )}
        {!paid && (
          <Link href="/" className="chrome mt-10 text-[11px] text-[#84848C] hover:text-[#F2F2F4]">
            Нүүр хуудас руу буцах →
          </Link>
        )}
      </main>
    );
  }

  // ─── Pricing step ───
  const free = PLANS.free;
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-10">
      <div className="chrome mb-3 flex items-center justify-center gap-2 text-[9px] font-bold">
        <span className="text-[#1080CA]">[PLAN]</span>
        <span className="text-[#1080CA]">/////</span>
        <span className="text-[#84848C]">НЭГ ҮНЭ · ДАЛД ТӨЛБӨРГҮЙ</span>
      </div>
      <h1 className="headline mb-3 text-center text-[clamp(26px,5vw,40px)]">Хэрхэн өсөхөө сонго</h1>
      <p className="mx-auto mb-10 max-w-xl text-center text-[14px] text-[#B4B4BA]">
        Эхлээд үнэгүй ор. Илүү гүн курс, mission, feedback хэрэгтэй болсон үедээ л upgrade хий.
        Сар бүр — хүссэн үедээ цуцлана.
      </p>

      {/* Billing period */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <button
          onClick={() => setPeriod("month")}
          className={`px-5 py-2 text-[12px] font-bold transition ${period === "month" ? "bg-[#1080CA] text-[#0E0E10]" : "border border-[#3A3A40] text-[#B4B4BA]"}`}
        >
          Сараар
        </button>
        <button
          onClick={() => setPeriod("year")}
          className={`px-5 py-2 text-[12px] font-bold transition ${period === "year" ? "bg-[#1080CA] text-[#0E0E10]" : "border border-[#3A3A40] text-[#B4B4BA]"}`}
        >
          Жилээр <span className="text-[#1080CA]">−20%</span>
        </button>
      </div>

      {/* 3 paid plans */}
      <div className="grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const active = PLAN_RANK[myPlan] >= PLAN_RANK[plan.id];
          const soon = !!plan.comingSoon;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col border p-6 ${soon ? "opacity-70" : ""} ${
                plan.highlight
                  ? "border-[#1080CA] bg-[#1E1E21]"
                  : "border-[#2E2E33] bg-[#1E1E21]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-6 bg-[#1080CA] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0E0E10]">
                  Нээлттэй · өнөөдөр эхэлнэ
                </div>
              )}
              <div className="chrome mb-1 text-[10px]" style={{ color: plan.accent }}>
                {plan.name.toUpperCase()}
              </div>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="headline text-[30px]">{formatMNT(period === "year" ? annualPrice(plan) : plan.price)}</span>
                <span className="text-[12px] text-[#84848C]">/{period === "year" ? "жил" : "сар"}</span>
              </div>
              {period === "year" && (
                <p className="mb-1 text-[11px] text-[#84848C]">
                  <s>{formatMNT(plan.price * 12)}</s> · −20% хэмнэлт
                </p>
              )}
              <p className="mb-1 text-[12px] font-semibold text-[#F2F2F4]">{plan.tagline}</p>
              <p className="mb-4 text-[12px] text-[#B4B4BA]">{plan.forWho}</p>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[12.5px] leading-snug text-[#F2F2F4]">
                    <span className="mt-[3px] h-[6px] w-[6px] shrink-0" style={{ background: plan.accent }} />
                    {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => !active && !soon && startPayment(plan)}
                disabled={submitting || active || soon}
                className={`w-full py-3.5 text-[13px] font-bold transition disabled:opacity-60 ${
                  plan.highlight
                    ? "bg-[#1080CA] text-[#0E0E10] hover:bg-[#4FA8E8]"
                    : "border border-[#3A3A40] text-[#F2F2F4] hover:border-[#F2F2F4]"
                }`}
              >
                {soon ? "Удахгүй нээгдэнэ" : active ? "Идэвхтэй ✓" : submitting && payingPlan?.id === plan.id ? "Түр хүлээнэ үү…" : plan.cta}
              </button>
              <p className="chrome mt-3 text-center text-[9px] text-[#84848C]">
                {soon ? "RUNNER ГИШҮҮДЭД ЭХЭЛЖ НЭЭГДЭНЭ" : "ТӨЛБӨРИЙН ДАРАА ШУУД НЭЭГДЭНЭ"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="chrome mt-5 text-center text-[9px] text-[#84848C]">
        ТӨЛБӨР ТӨЛӨГДМӨГЦ ЭРХ АВТОМАТААР ИДЭВХЖИНЭ · ХҮССЭН ҮЕДЭЭ ЦУЦАЛНА
      </p>

      {/* Collapsible comparison */}
      <div className="mt-8 border border-[#2E2E33]">
        <button
          onClick={() => setShowCompare((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4 text-[13px] font-semibold text-[#F2F2F4]"
        >
          Дэлгэрэнгүй харьцуулалт
          <span className="chrome text-[10px] text-[#84848C]">{showCompare ? "ХААХ −" : "НЭЭХ +"}</span>
        </button>
        {showCompare && (
          <div className="overflow-x-auto border-t border-[#2E2E33]">
            <table className="w-full min-w-[560px] text-[12px]">
              <thead>
                <tr className="chrome text-left text-[9px] text-[#84848C]">
                  <th className="px-5 py-3 font-normal">ЮУ БАГТАНА</th>
                  <th className="px-3 py-3 font-normal">FREE</th>
                  <th className="px-3 py-3 font-normal text-[#1080CA]">RUNNER</th>
                  <th className="px-3 py-3 font-normal">NETRUNNER</th>
                  <th className="px-3 py-3 font-normal">EDGERUNNER</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.label} className="border-t border-[#2E2E33] text-[#F2F2F4]">
                    <td className="px-5 py-3 font-semibold text-[#F2F2F4]">{row.label}</td>
                    <td className="px-3 py-3">{row.free}</td>
                    <td className="px-3 py-3">{row.starter}</td>
                    <td className="px-3 py-3">{row.builder}</td>
                    <td className="px-3 py-3">{row.operator}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[12px] text-[#84848C]">
        Төлбөр банкны шилжүүлгээр. Баталгаажмагц контент шууд нээгдэнэ · Хүссэн үедээ цуцлана
      </p>
    </main>
  );
}

// ─── Bank detail row with copy ───
function BankRow({
  label, value, field, copied, onCopy, mono, highlight, copyText,
}: {
  label: string;
  value: string;
  field: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
  mono?: boolean;
  highlight?: boolean;
  copyText?: string;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-[#2E2E33] px-4 py-3 last:border-b-0 ${highlight ? "bg-[rgba(16,128,202,0.07)]" : ""}`}>
      <div>
        <div className="chrome text-[9px] text-[#84848C]">{label.toUpperCase()}</div>
        <div className={`text-[14px] ${mono ? "font-mono tracking-wider" : ""} ${highlight ? "font-bold text-[#1080CA]" : "text-[#F2F2F4]"}`}>
          {value}
        </div>
      </div>
      <button
        onClick={() => onCopy(copyText ?? value, field)}
        className="chrome border border-[#3A3A40] px-3 py-1.5 text-[9px] text-[#B4B4BA] transition hover:border-[#F2F2F4] hover:text-[#F2F2F4]"
      >
        {copied === field ? "ХУУЛСАН ✓" : "ХУУЛАХ"}
      </button>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PricingInner />
    </Suspense>
  );
}
