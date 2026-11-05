"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SwipeDeck, { SwipeDots } from "@/components/SwipeDeck";
import { Suspense } from "react";
import { PLANS, PAID_PLANS, PLAN_RANK, TERMS_TEXT, GUARANTEE_TEXT, formatMNT, annualPrice, isPaidPlanId, type PlanId, type PlanDef } from "@/lib/plans";

/* The toggle only earns its place when something on sale is actually billed
   per period. It stays computed rather than hardcoded so that taking the last
   periodic plan off the market hides it again on its own. */
const HAS_PERIODIC_PLAN = PAID_PLANS.some((p) => !p.oneTime);
import { track, trackOnce } from "@/lib/analytics";
import { SUPPORT_IG_URL, SUPPORT_PHONE } from "@/lib/links";

// ─── Bank transfer details (same account as the clan flow) ───
const BANK_ACCOUNT = "5926153085";
const BANK_NAME = "Хаан банк";
const BANK_RECIPIENT = "Баянбилэг Дамбадаржаа";
/* public/qpay.png — статик QPay QR. Статик учраас ДҮН нь дотор нь шигтгээгүй:
   хүн апп дээрээ дүнгээ өөрөө оруулна. Тиймээс QR-ийн хажууд дүн, лавлах код
   хоёрыг үргэлж хамт харуулна — эс бөгөөс банкны автомат тааруулагч тэр
   гүйлгээг танихгүй. */

type Step = "pricing" | "payment" | "pending";

interface PaymentState {
  _id?: string;
  status?: "pending" | "paid" | "failed";
  referenceCode?: string;
  /** Гүйлгээний утганд бичихийг ХҮНД заадаг зүйл. Ref код нь DB-д хэвээр
      үлдэж, авто-тааруулагчийн эхний дохио болсоор байна. */
  username?: string;
  amount?: number;
  plan?: string;
}

function PricingInner() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("pricing");
  const [payingPlan, setPayingPlan] = useState<PlanDef | null>(null);
  const [payment, setPayment] = useState<PaymentState>({});
  const [submitting, setSubmitting] = useState(false);
  /* Сервер төлбөр эхлүүлэхээс ТАТГАЛЗСАНЫГ хэлэх мөр. Өмнө нь энэ хариу
     хаана ч гарч ирдэггүй байсан: `if (data.paymentId)` биелэхгүй бол
     функц чимээгүй дуусч, товч дарагдсан атал дэлгэц хөдлөхгүй үлддэг —
     хүн юу болсныг, дахин дарах эсэхээ мэдэхгүй. */
  const [joinErr, setJoinErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  /* ─── Төлөх АРГА ──────────────────────────────────────────────────
     Кредит худалдан авалттай ижил хоёр зам. Өмнө нь энэ дэлгэц зөвхөн
     нэг замтай байсан: статик QR — дүн нь дотор нь БАЙХГҮЙ тул хүн дүн
     болон гүйлгээний утгаа ГАРААР бичдэг, аль нэгийг нь буруу бичихэд
     төлбөр хэзээ ч таарахгүй. Одоо QPay нь Wire-ийн нэхэмжлэх (дүн +
     дугаар дотор нь) болж, дансаар шилжүүлэх зам нь баримт хавсаргах
     боломжтой болов. */
  /* QPay ДАХИН АНХДАГЧ (2026-10-06). Өмнө нь "QPay ажиллахгүй байна"
     гэж үзээд авсан байсан — гэвч Wire-ийн түлхүүр, intent → checkout
     session → pay.wire.mn QR бүгд амьд байсан (шалгасан). Эвдэрсэн нь
     2026-09-08-нд засагдсан 10 минутын үхсэн-intent урхи байсан. Данс нь
     хоёр дахь сонголт хэвээр — Wire алдаа өгвөл хүн тийшээ шилжинэ. */
  const [method, setMethod] = useState<"qpay" | "bank">("qpay");
  const [wireBusy, setWireBusy] = useState(false);
  const [wireErr, setWireErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [hasReceipt, setHasReceipt] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);
  const [myPlan, setMyPlan] = useState<PlanId>("free");
  // Тарифын гулсуурын байрлал — SwipeDeck зогсоолын тоог өөрөө хэмжиж хэлнэ.
  const [planIdx, setPlanIdx] = useState(0);
  const [planPages, setPlanPages] = useState(1);
  /* Админаас засагдсан тарифууд. Эхлээд кодын өгөгдмөлөөр зурчихаад,
     ирмэгц нь солино — API удаашрахад хуудас хоосон харагдахгүй. */
  const [salePlans, setSalePlans] = useState<PlanDef[]>(PAID_PLANS);
  /* ⚠ ЭНЭ НЬ startPayment-ЭЭС ДЭЭР ЗАРЛАГДАХ ЁСТОЙ. Өмнө нь доор, файлын
     дунд зарлагдсан байсан бөгөөд startPayment-ийн useCallback-ийн хамаарлын
     жагсаалтад ч ороогүй байв. Үр дүн нь: хүн "Жилээр" дарж, картан дээр
     жилийн үнийг хараад худалдаж авахад сервер рүү `period: "month"` явдаг
     байсан — өөрөөр хэлбэл харсан дүн нь төлөх дүнгээсээ өөр. Банкны автомат
     тааруулагч ДҮНГЭЭР таньдаг тул тэр шилжүүлэг хэзээ ч баталгаажихгүй. */
  const [period, setPeriod] = useState<"month" | "year">("month");
  // Deep link: /pricing?period=year preselects annual billing (homepage toggle)
  useEffect(() => {
    if (searchParams.get("period") === "year") setPeriod("year");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paymentSeconds, setPaymentSeconds] = useState(10 * 60);

  /* Гүйлгээний утгыг нэрээр солих жижиг урсгал. `/pricing`-д амьдрах
     шалтгаан: энд байгаа хүн бол ЯГ ОДОО мөнгө шилжүүлэх гэж байгаа хүн.
     Тохиргооны хуудсанд нуувал хэзээ ч хийгдэхгүй. */
  const [tagEditing, setTagEditing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestion, setTagSuggestion] = useState("");
  const [tagSaving, setTagSaving] = useState(false);
  const [tagSaved, setTagSaved] = useState(false);
  const [tagError, setTagError] = useState("");

  useEffect(() => {
    if (!session) return;
    fetch("/api/users/me/username")
      .then((r) => r.json())
      .then((d) => { if (d?.suggestion) setTagSuggestion(String(d.suggestion)); })
      .catch(() => {});
  }, [session]);

  const saveTag = useCallback(async () => {
    setTagSaving(true);
    setTagError("");
    try {
      const res = await fetch("/api/users/me/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: tagInput }),
      });
      const d = await res.json();
      if (!res.ok) { setTagError(d?.error || "Хадгалж чадсангүй"); return; }
      /* Төлбөрийн бичлэгийг ЭНД шинэчилнэ — сервер рүү дахин явахгүй.
         Дэлгэц дээрх код тэр дороо нэр болж солигдох ёстой, эс бөгөөс
         хүн аль нь хүчинтэйг мэдэхгүй болно. */
      setPayment((p) => ({ ...p, username: d.username }));
      setTagSaved(true);
      setTagEditing(false);
    } finally {
      setTagSaving(false);
    }
  }, [tagInput]);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.plans) && d.plans.length > 0) setSalePlans(d.plans as PlanDef[]);
      })
      .catch(() => {});
  }, []);

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
    setJoinErr("");
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
          username: data.username,
          amount: data.amount,
          plan: data.plan,
        });
        setPaymentSeconds(10 * 60);
        track("payment_started", { plan: plan.id, amount: data.amount });
        if (data.hasReceipt) {
          setStep("pending");
          return;
        }

        /* Нэг хүсэлтээр шууд Antaqor доторх QR + банкны дансны дэлгэц рүү
           орно. Гуравдагч талын checkout эвдэрсэн ч худалдан авагчийг
           гацуулахгүй; одоо харагдаж буй данс, дүн, код нь серверийн үүсгэсэн
           яг энэ Payment бичлэгтэй таарна. */
        setStep("payment");
        return;
      }
      /* Энд ирлээ гэдэг нь сервер төлбөр үүсгээгүй гэсэн үг. Шалтгааныг
         нь хэлнэ — ялангуяа "энэ тариф зарагдахгүй байна" гэдэг нь
         хуудсаа сэргээхэд шийдэгддэг тул хүнд хэлэх нь чухал. */
      setJoinErr(
        data?.error === "founding_full"
          ? String(data?.message || "Энэ тариф дүүрсэн байна.")
          : data?.error === "plan_unavailable"
            ? "Энэ тариф одоо зарагдахгүй байна. Хуудсаа сэргээгээд дахин үзнэ үү."
            : data?.error === "no_plans_on_sale"
              ? "Тариф түр боломжгүй байна. Хэсэг хүлээгээд дахин оролдоно уу."
              : "Төлбөр эхлүүлж чадсангүй. Дахин оролдоно уу."
      );
    } catch {
      setJoinErr("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setSubmitting(false);
    }
  }, [session, router, period]);

  // Deep link: /pricing?plan=builder auto-opens payment (used by upgrade modals)
  useEffect(() => {
    const p = searchParams.get("plan");
    if (p && isPaidPlanId(p) && !PLANS[p].comingSoon && step === "pricing" && !submitting && session) {
      startPayment(PLANS[p]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);


  /* QPay — Wire-ийн хостолсон нэхэмжлэх. Дүн болон захиалгын дугаар нь
     нэхэмжлэхэд шигтгээтэй тул худалдан авагчид бичих зүйл үлдэхгүй,
     баталгаажуулалт нь автомат (payment-status poll Wire-ийг шалгана). */
  const payWithQpay = async () => {
    if (wireBusy) return;
    setWireErr("");
    setWireBusy(true);
    try {
      const r = await fetch("/api/wire/checkout", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.paid) {
        setStep("pending");
        return;
      }
      if (!r.ok || !d.url) {
        setWireErr(
          d.error === "wire_disabled"
            ? "QPay түр боломжгүй байна. Дансаар шилжүүлнэ үү."
            : "QPay нээж чадсангүй. Дансаар шилжүүлж болно."
        );
        setMethod("bank");
        return;
      }
      track("payment_qpay_open", { plan: payingPlan?.id });
      window.location.href = d.url;
    } catch {
      setWireErr("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setWireBusy(false);
    }
  };

  /* Баримт — дансаар шилжүүлсэн хүний ЦОРЫН ГАНЦ хэлэх арга.
     Энэ маршрут админ бүр рүү push илгээдэг тул батлах нь цаг биш,
     минутын асуудал болно. */
  const uploadReceipt = async (file: File) => {
    setUploading(true);
    setUploadErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const ud = await up.json();
      if (!up.ok || !ud.url) throw new Error(ud.error || "Зураг хадгалж чадсангүй");
      const r = await fetch("/api/clan/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptImage: ud.url, paymentId: payment._id || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Баримт илгээж чадсангүй");
      setHasReceipt(true);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : "Алдаа");
    } finally {
      setUploading(false);
    }
  };

  // Poll payment status while pending
  /* Төлбөрийн дэлгэц дээр БАЙХДАА ч шалгана. Өмнө нь зөвхөн "pending"
     алхамд шалгадаг байсан тул хүн шилжүүлгээ хийчихээд "Шилжүүлсэн"
     товчийг дарж байж л систем харж эхэлдэг байв — банк аль хэдийн
     баталгаажуулсан атал дэлгэц хүний товшилтыг хүлээж зогсох нь
     утгагүй. Одоо баталгаажмагц өөрөө урагшилна. */
  useEffect(() => {
    if (step !== "pending" && step !== "payment") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/clan/payment-status");
        const data = await res.json();
        if (cancelled || !data.payment) return;
        setPayment((prev) => ({ ...prev, status: data.payment.status }));
        if (data.payment.status === "paid" && step === "payment") setStep("pending");
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

  /* Борлуулалтын мөчийг сулруулахгүй 15 минутын чиглүүлэгч. Энэ нь хуурамч
     expiry биш: 00:00 болсны дараа ч нэхэмжлэх хүчинтэй гэдгийг дэлгэц дээр
     шууд хэлнэ. Payment-ийн id солигдоход л шинээр эхэлнэ. */
  useEffect(() => {
    if (step !== "payment") return;
    const timer = window.setInterval(() => {
      setPaymentSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, payment._id]);

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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  // ─── Payment step ───
  /* НЭГ ДЭЛГЭЦ, НЭГ ЗОРИЛГО: мөнгө шилжүүлэх.

     Өмнө нь энэ дэлгэц дээр долоон блок байсан — 15 минутын том тоолуур,
     гурван ашиг тусын мөр, баталгааны мөр, лавлах кодын хайрцаг, QR-ийн
     гурван алхамт заавар, таван мөрт банкны хүснэгт, хоёр урт тайлбар.
     Хүн шилжүүлэг хийхийн тулд ГУРВАН зүйл л мэдэх ёстой: хэдэн төгрөг,
     хаана, ямар утгатай. Бусад нь бүгд тэр гурвыг олох ажлыг хүндрүүлж
     байв.

     Одоо: үнэ → QR → гүйлгээний утга → (нугалсан) банкны мэдээлэл → нэг
     товч. Тоолуур нь ганц мөр болж жижгэрлээ — тэр нь мэдээлэл болохоос
     шийдвэр биш. Ашиг тусын жагсаалт нь өмнөх алхам (/pricing) дээр яг
     энэ хүний саяхан уншсан зүйл; түүнийг давтах нь шийдвэрийг бэхжүүлэхгүй,
     зөвхөн гүйлгээ хүртэлх замыг уртасгана. */
  if (step === "payment" && payingPlan) {
    const amount = payment.amount || payingPlan.price;
    /* Худалдан авагчид ХАРУУЛАХ таних тэмдэг. Username нь хүн өөрөө мэддэг,
       банкны апп дээр алдалгүй бичдэг зүйл; 6 тэмдэгт санамсаргүй код тийм
       биш. Ref код нь ноолуур: username ямар нэг шалтгаанаар ирээгүй бол
       блок хоосон үлдэхийн оронд код руу шилжинэ. Хоёулаа
       auto-match/route.ts дээр таних дохио. */
    const payTag = payment.username || payment.referenceCode || "—";
    const countdown = `${String(Math.floor(paymentSeconds / 60)).padStart(2, "0")}:${String(paymentSeconds % 60).padStart(2, "0")}`;

    return (
      <main className="mx-auto w-full max-w-md px-4 pb-[var(--sp-8)] pt-[var(--sp-5)]">
        <button
          onClick={() => setStep("pricing")}
          className="press t-sec mb-[var(--sp-6)] text-[#E2E4E8] transition hover:text-[#F2F2F4]"
        >
          ← Буцах
        </button>

        {/* ─── 1 · Юуны төлөө, хэдэн төгрөг ─── */}
        <div className="chrome text-[11px] font-bold uppercase tracking-[0.16em] text-[#E2E4E8]">
          {payingPlan.name}
        </div>
        {/* ─── Дүн ба ХУГАЦАА зэрэгцэнэ ────────────────────────────────
            Тоолуур өмнө нь хуудасны хамгийн доод талд, саарал жижиг
            мөрөнд шивнэж байсан — өөрөөр хэлбэл хэн ч хардаггүй байв.
            Мөнгө шилжүүлэх гэж байгаа хүний нүд ҮНЭ дээр буудаг; цаг
            хугацаа тэр дор нь байж гэмээнэ утга учиртай.

            Тоо нь ХУДАЛ БИШ: 5 минутаас доош үлдэхэд өнгө нь анхааруулга
            болж өөрчлөгдөнө, харин 00:00 болоход "хугацаа дууслаа" гэж
            айлгахгүй — нэхэмжлэх үнэхээр хүчинтэй хэвээр байдаг тул тэгж
            бичих нь зүгээр л худал болно. */}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="t-display text-[#F2F2F4]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatMNT(amount)}
          </div>
          <div
            className="text-[15px] font-bold"
            style={{
              fontVariantNumeric: "tabular-nums",
              color:
                paymentSeconds === 0
                  ? "var(--t-sub, #9C9CA6)"
                  : paymentSeconds < 300
                    ? "#D81B4A"
                    : "var(--t-ink, #F2F2F4)",
            }}
          >
            {paymentSeconds > 0 ? countdown : "Хүчинтэй"}
          </div>
        </div>

        {/* ─── 2 · Төлөх арга ─── */}
        <div className="mt-[var(--sp-6)] flex gap-1 rounded-[4px] p-1" style={{ border: "1px solid var(--t-line, rgba(255,255,255,0.12))" }}>
          {([["qpay", "QPay"], ["bank", "Дансаар"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              aria-pressed={method === id}
              className="flex-1 rounded-[4px] py-2 text-[12.5px] font-bold transition"
              style={
                method === id
                  ? { background: "rgba(46,41,255,0.14)", color: "var(--accent-ink, #2E29FF)" }
                  : { color: "var(--t-sub, #565967)" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        {method === "qpay" && (
          <div className="mt-[var(--sp-4)] space-y-3">
            <p className="text-[12.5px] leading-relaxed text-[#E2E4E8]">
              Дүн нэхэмжлэхэд бэлэн — юу ч бичих шаардлагагүй. Төлмөгц эрх{" "}
              <b className="text-[#F2F2F4]">шууд</b> нээгдэнэ.
            </p>
            <button
              type="button"
              onClick={payWithQpay}
              disabled={wireBusy}
              className="press h-[var(--h-cta)] w-full rounded-[4px] bg-[#2E29FF] text-[15px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-40"
            >
              {wireBusy ? "Нээж байна…" : `QPay-ээр ${formatMNT(amount)} төлөх`}
            </button>
          </div>
        )}
        {wireErr && <div className="t-meta mt-2 text-[#D81B4A]">{wireErr}</div>}

        {/* ─── 3 · Гүйлгээний утга — ЗӨВХӨН дансаар шилжүүлэхэд ──────────
            Банкны автомат тааруулагч төлбөрийг зөвхөн үүгээр танина.
            QPay (Wire) замд ХЭРЭГГҮЙ: тэнд нэхэмжлэх өөрөө захиалгын
            дугаараа авч явдаг тул хүнээр юу ч бичүүлэх шаардлагагүй —
            энд харуулбал зөвхөн эргэлзээ төрүүлнэ. */}
        {method === "bank" && (<>
        <div className="mt-[var(--sp-4)] bg-[rgba(46,41,255,0.10)] p-4" style={{ borderRadius: 4 }}>
          {/* Том үсгээр бичсэн монгол урт мөр (`ГҮЙЛГЭЭНИЙ УТГА · ЗААВАЛ
              БИЧНЭ`) кирилл дээр уншихад хэцүү — үсгийн өндөр тэгшхэн
              болж, үгийн хэлбэр алга болдог. Хоёр мөр, энгийн бичиглэл. */}
          <div className="t-sec font-bold text-[#F2F2F4]">Гүйлгээний утга</div>
          <div className="t-meta mt-0.5 text-[#2E29FF]">Заавал бичнэ</div>

          <CopyValue
            value={payTag}
            field="ref"
            copied={copied}
            onCopy={copyToClipboard}
            className="mt-[var(--sp-3)]"
            emphasis
          />

          {/* ─── САНАМСАРГҮЙ КОДЫГ НЭРЭЭР СОЛИХ ──────────────────────────
              650 бүртгэлийн 571 нь `username`-гүй байсан тул тэдэнд
              `K7M3PQ` шиг код харагддаг. Хүн өөрийн нэрээ зөв бичдэг,
              санамсаргүй кодыг банкны аппд буруу бичдэг — буруу бичсэн
              утга нь автомат тааруулагчид хэзээ ч танигдахгүй, мөнгө нь
              өлгөөтэй үлдэнэ. Тиймээс ЯГ ЭНД, шилжүүлэг хийхээс нь өмнө
              нэрээ тавих боломжийг санал болгоно. Заавал биш: код нь
              ажилласаар байна. */}
          {!payment.username && (
            <div className="mt-[var(--sp-3)] border-t border-[rgba(46,41,255,0.25)] pt-[var(--sp-3)]">
              {tagSaved ? (
                <p className="t-meta font-semibold text-[#F2F2F4]">
                  Гүйлгээний утга нэрээр солигдлоо ✓
                </p>
              ) : tagEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => { setTagInput(e.target.value); setTagError(""); }}
                    placeholder="жишээ: bataa"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="h-[var(--h-compact)] min-w-0 flex-1 rounded-[4px] bg-[#0A0A0A] px-3 font-mono text-[14px] text-[#F2F2F4] outline-none focus:ring-2 focus:ring-[#2E29FF]"
                  />
                  <button
                    onClick={saveTag}
                    disabled={tagSaving}
                    className="press h-[var(--h-compact)] shrink-0 rounded-[4px] bg-[#2E29FF] px-4 text-[13px] font-bold text-white disabled:opacity-60"
                  >
                    {tagSaving ? "…" : "Хадгалах"}
                  </button>
                  {tagError && <p className="t-meta w-full text-[#4C47FF]">{tagError}</p>}
                </div>
              ) : (
                <button
                  onClick={() => { setTagEditing(true); setTagInput(tagSuggestion); }}
                  className="press t-meta font-semibold text-[#2E29FF] underline underline-offset-4 hover:opacity-80"
                >
                  Кодын оронд нэрээ бичих үү?
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── 4 · Банкны мэдээлэл — нугалсан ─────────────────────────────
            QR-аар төлж чадаж байгаа хүнд эдгээр мөр хэрэггүй. Хэрэгтэй
            хүн нь нэг товшилтын зайд. Нугалах нь мэдээллийг нуухгүй,
            дараалалд оруулна. */}
        <details open className="group mt-[var(--sp-4)] bg-[#0A0A0A]" style={{ borderRadius: 4 }}>
          <summary className="press flex h-[var(--h-standard)] cursor-pointer list-none items-center justify-between px-4 [&::-webkit-details-marker]:hidden">
            <span className="t-sec font-semibold text-[#F2F2F4]">Банкны мэдээлэл</span>
            <span className="t-sec text-[#E2E4E8] transition-transform duration-200 group-open:rotate-180" aria-hidden>
              ▾
            </span>
          </summary>
          <div className="px-4 pb-4">
            <BankRow label="Банк" value={BANK_NAME} field="bank" copied={copied} onCopy={copyToClipboard} />
            <BankRow label="Данс" value={BANK_ACCOUNT} field="account" copied={copied} onCopy={copyToClipboard} mono />
            <BankRow label="Хүлээн авагч" value={BANK_RECIPIENT} field="recipient" copied={copied} onCopy={copyToClipboard} />
            <BankRow label="Дүн" value={formatMNT(amount)} field="amount" copyText={String(amount)} copied={copied} onCopy={copyToClipboard} mono />
            <BankRow label="Гүйлгээний утга" value={payTag} field="ref2" copied={copied} onCopy={copyToClipboard} mono highlight />
          </div>
        </details>

        {/* ─── Баримт хавсаргах ───────────────────────────────────────────
            Мөнгөө явуулсан хүний "би төлчихсөн" гэж хэлэх ЦОРЫН ГАНЦ зам.
            Үүнгүйгээр 313 хүлээгдэж буй гишүүнчлэлийн төлбөрийн ердөө 4
            нь л баримттай байв — үлдсэн нь админ банкны хуулгаа гараар
            тулгах хүртэл өлгөөтэй. */}
        <div className="mt-[var(--sp-4)] bg-[#0A0A0A] p-4" style={{ borderRadius: 4 }}>
          {hasReceipt ? (
            <div className="t-sec font-bold text-[#F2F2F4]">✓ Баримт илгээгдлээ</div>
          ) : (
            <>
              <div className="t-sec font-semibold text-[#F2F2F4]">Шилжүүлсэн үү?</div>
              <p className="t-meta mt-1 text-[#E2E4E8]">Баримтын зургаа оруулбал хурдан батлагдана.</p>
              <button
                type="button"
                onClick={() => receiptRef.current?.click()}
                disabled={uploading}
                className="press mt-[var(--sp-3)] h-[var(--h-standard)] w-full rounded-[4px] bg-[rgba(46,41,255,0.14)] text-[13px] font-bold text-[#2E29FF] transition disabled:opacity-40"
              >
                {uploading ? "Илгээж байна…" : "Баримт оруулах"}
              </button>
              {uploadErr && <div className="t-meta mt-2 text-[#2E29FF]">{uploadErr}</div>}
            </>
          )}
          <input
            ref={receiptRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadReceipt(f);
              if (receiptRef.current) receiptRef.current.value = "";
            }}
          />
        </div>
        </>)}

        {/* "Төлбөр шалгах" товч 2026-09-04-нд хасагдав. Хуудас аль хэдийн
            10 секунд тутам өөрөө шалгадаг байсан тул тэр товч юу ч
            хийдэггүй — зөвхөн "би дарах ёстой юм болов уу" гэсэн эргэлзээ
            төрүүлж, төлөөгүй хүнийг хүлээх дэлгэц рүү илгээдэг байв.
            Систем өөрөө мэдэж байгаа зүйлийг хүнээр дарамтлах хэрэггүй. */
}
        {/* ─── 6 · Мета — хамгийн нам ─────────────────────────────────────
            Тоолуур нь хуурамч expiry биш, зөвхөн чиглүүлэгч. Тиймээс том
            улаан хайрцаг биш, нэг мөр. 00:00 болсны дараа ч нэхэмжлэх
            хүчинтэй гэдгийг ЭНД шууд хэлнэ — тэгэхгүй бол тоолуур
            айлгах хэрэгсэл болно. */}
        {/* Хүлээж байгаа хүнд ХЭРЭГТЭЙ ганц зүйл: "систем намайг хараад
            байна уу". Цохилж буй цэг түүнийг өгүүлбэргүйгээр хэлнэ. */}
        <div className="mt-[var(--sp-5)] flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2E29FF]" />
          <span className="t-meta text-[#E2E4E8]">{GUARANTEE_TEXT}</span>
        </div>

        {/* ─── Холбоо барих ───────────────────────────────────────────────
            Мөнгө шилжүүлж байгаа хүн эргэлзвэл хүнтэй ярих зам НЭГ
            товшилтын зайд байх ёстой. Байхгүй бол тэр хүн асуухын оронд
            зүгээр л хаагаад явна — тэр нь алдагдсан борлуулалт, бас
            алдагдсан итгэл. */}
        <div className="mt-[var(--sp-5)] border-t border-[#1E1E1E] pt-[var(--sp-4)]">
          <div className="flex items-center justify-center gap-2">
            <a
              href={SUPPORT_IG_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="press flex-1 rounded-[4px] bg-[#0A0A0A] py-2.5 text-center text-[12.5px] font-semibold text-[#E2E4E8] transition hover:text-[#2E29FF]"
            >
              @antaqor
            </a>
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className="press flex-1 rounded-[4px] bg-[#0A0A0A] py-2.5 text-center text-[12.5px] font-semibold tabular-nums text-[#E2E4E8] transition hover:text-[#2E29FF]"
            >
              {SUPPORT_PHONE}
            </a>
          </div>
        </div>
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
        <p className="mb-8 max-w-sm text-[13px] leading-relaxed text-[#E2E4E8]">
          {paid
            ? "Контент нээгдлээ. Dashboard руу шилжиж байна…"
            : `Шилжүүлэг ихэвчлэн хэдхэн минутад баталгаажна. Гүйлгээний утга: ${payment.username || payment.referenceCode || "—"}. Энэ хуудсыг хааж болно — баталгаажмагц мэдэгдэл очно.`}
        </p>
        {!paid && (
          <div className="h-1 w-48 overflow-hidden bg-[#262626]">
            <div className="h-full w-1/3 animate-pulse bg-[#2E29FF]" />
          </div>
        )}
        {!paid && (
          <Link href="/" className="chrome mt-10 text-[11px] text-[#E2E4E8] hover:text-[#F2F2F4]">
            Нүүр хуудас руу буцах →
          </Link>
        )}
      </main>
    );
  }

  // ─── Pricing step ───
  /* Картын бие НЭГ л газар бичигдэнэ. `solo` нь зөвхөн ӨРГӨНИЙГ шийднэ —
     ганц карт бүтэн өргөнөө авна, олон карт нь гулсуурын зогсоол болно.
     Хоёр тусдаа хувилбар бичих нь хоёр тусдаа алдаа гэсэн үг. */
  const renderPlan = (plan: PlanDef, solo: boolean) => {
    const isFree = plan.price === 0;
    const owned = PLAN_RANK[myPlan] >= PLAN_RANK[plan.id];
    const yearly = annualPrice(plan);
    // Жилээр сонговол САРЫН бодит үнийг том харуулна — хүн сартай нь
    // харьцуулж ойлгодог, жилийн бүтэн дүн нь доор жижгээр.
    const shown = isFree ? 0 : period === "year" ? Math.round(yearly / 12) : plan.price;

    return (
      <div
        key={plan.id}
        className={`relative flex flex-col bg-[#141414] ${
          solo
            ? "w-full p-6"
            : "w-[82%] max-w-[320px] shrink-0 p-5 sm:w-[calc((100%-16px)/2)] sm:max-w-none sm:p-6 lg:w-[calc((100%-32px)/3)]"
        } ${plan.highlight ? "ring-1 ring-[#2E29FF]/45" : ""}`}
      >
        {plan.highlight && (
          <span className="absolute -top-2.5 left-6 bg-[#FCEE0A] px-2.5 py-0.5 text-[11px] font-bold text-[#0A0A0A]">
            ★ Санал болгох
          </span>
        )}

        <div className="su-overline mb-2" style={{ color: plan.accent }}>
          {plan.name}
        </div>
        <p className="mb-3 min-h-[36px] text-[12.5px] leading-snug text-[#E2E4E8]">
          {plan.tagline}
        </p>

        {/* ─── ШАТУУДЫГ ЯЛГАДАГ ГАНЦ ГАЗАР ─────────────────────────────
            Давуу талын жагсаалт гурван шатанд ИЖИЛ (MEMBERSHIP_BENEFITS).
            Тиймээс "яагаад 49,000, 14,900 биш вэ" гэсэн асуултад хариулах
            цорын ганц зүйл нь эдгээр хоёр мөр. Хоосон бол огт зай эзлэхгүй
            — админ хоосон орхивол карт эмх цэгцтэй хэвээр байна. */}
        {plan.forWho && (
          <p className="mb-2 text-[12px] leading-snug text-[#E2E4E8]">
            <span className="font-semibold text-[#E2E4E8]">Хэнд:</span> {plan.forWho}
          </p>
        )}
        {plan.outcome && (
          <p className="mb-5 border-l-2 pl-2.5 text-[12.5px] font-semibold leading-snug text-[#F2F2F4]"
             style={{ borderColor: plan.accent }}>
            {plan.outcome}
          </p>
        )}

        <div className="flex items-baseline gap-1.5">
          <span className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white">
            {formatMNT(shown)}
          </span>
          <span className="text-[12px] text-[#E2E4E8]">/ сар</span>
        </div>
        <p className="mt-1.5 min-h-[16px] text-[11.5px] text-[#E2E4E8]">
          {isFree
            ? "Үүрд үнэгүй"
            : period === "year"
              ? `${formatMNT(yearly)} / жил · −20%`
              : "сар бүр"}
        </p>

        <button
          onClick={() => !isFree && !owned && startPayment(plan)}
          disabled={isFree || owned || submitting}
          className={`mt-4 h-11 w-full rounded-[4px] text-[13.5px] font-bold transition disabled:opacity-50 ${
            plan.highlight
              ? "bg-[#2E29FF] text-white hover:bg-[#1F1AD9]"
              : "bg-[#1E1E1E] text-white hover:bg-[#2C2C31]"
          }`}
        >
          {owned
            ? "Идэвхтэй ✓"
            : isFree
              ? "Одоогийн"
              : submitting && payingPlan?.id === plan.id
                ? "Түр хүлээнэ үү…"
                : plan.cta}
        </button>

        <ul className="mt-5 flex-1 space-y-2">
          {plan.benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[12.5px] leading-snug text-[#F2F2F4]">
              <Icon name="check" size={16} className="mt-[2px] shrink-0" style={{ color: plan.accent }} />
              {b}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pb-24 pt-4 md:pt-8">
      {/* Гарчиг нь ХАРАГДАХГҮЙ болсон ч УСТААГҮЙ. Дэлгэц уншигч болон
          хайлтын систем хуудас бүрээс нэг h1 хүлээдэг; түүнийг зүгээр
          хаявал хуудас "нэргүй" болно. Харагдах "ҮНЭ · Нэг үнэ · далд
          төлбөргүй" мөр нь юу ч зарлаагүй — тарифын карт өөрөө үнээ
          хэлж байхад давхардсан чимэг байв. */}
      <h1 className="sr-only">Гишүүнчлэлийн үнэ</h1>

      {joinErr && (
        <div
          role="alert"
          className="mx-auto mb-4 max-w-[520px] rounded-[4px] border border-[#2E29FF]/40 bg-[#2E29FF]/10 px-4 py-3 text-center text-[12.5px] leading-relaxed text-[#2E29FF]"
        >
          {joinErr}
        </div>
      )}


      {/* Billing period — only when something is actually billed periodically */}
      {HAS_PERIODIC_PLAN && (
      <div className="mb-6 flex items-center justify-center gap-2">
        <button
          onClick={() => setPeriod("month")}
          className={`h-10 rounded-[4px] px-5 text-[13px] font-semibold transition ${period === "month" ? "bg-[#2E29FF] text-white" : "bg-[#1E1E1E] text-[#E2E4E8]"}`}
        >
          Сараар
        </button>
        <button
          onClick={() => setPeriod("year")}
          className={`h-10 rounded-[4px] px-5 text-[13px] font-semibold transition ${period === "year" ? "bg-[#2E29FF] text-white" : "bg-[#1E1E1E] text-[#E2E4E8]"}`}
        >
          Жилээр <span className="text-[#2E29FF]">−20%</span>
        </button>
      </div>
      )}

      {/* ─── Тарифууд — чирж болдог тавцан ────────────────────────────
          Утсанд 1 (дараагийнх нь цухуйна), таблетад 2, ширээнд 3.
          Ялгаа нь зан: lg дээр гурвуулаа багтах учир SwipeDeck гулсалтыг
          ӨӨРӨӨ унтраадаг (maxIndex 0 болно) — өөрөөр хэлбэл ширээний
          дэлгэцэд яг л сүлжээ хэвээрээ, зөвхөн нарийн дэлгэцэд гулсуур
          болно. Хоёр өөр бүрэлдэхүүн, хоёр өөр код хэрэггүй.

          Картын өргөн 85% нь санамсаргүй биш: дараагийн картын ирмэг
          харагдаж, "цааш байна" гэдгийг сум зурахгүйгээр хэлнэ. */}
      {/* ─── Тарифууд ──────────────────────────────────────────────────
          НЭГ тариф зарагдаж байхад гулсуур нь худал: гулсах зүйл байхгүй
          атал карт нь зүүн ирмэгт наалдаж, "★ Санал болгох" шошго нь
          дэлгэцээс гарч, баруун тал нь хоосон үлддэг. Ганц карт бол
          жагсаалт биш, МЭДЭГДЭЛ — тиймээс голлуулж, өргөнийг нь өгнө.
          Хоёр ба түүнээс дээш үед л гулсуур утгатай болно. */}
      {salePlans.length === 1 ? (
        <div className="flex justify-center pt-3">
          <div className="w-full max-w-[420px]">{renderPlan(salePlans[0], true)}</div>
        </div>
      ) : (
        <>
          <SwipeDeck
            index={planIdx}
            onIndexChange={setPlanIdx}
            onPagesChange={setPlanPages}
            gap={16}
            edgeBleed={16}
            ariaLabel="Тарифууд"
            trackClassName="items-stretch pb-1 pt-3"
          >
            {salePlans.map((plan) => renderPlan(plan, false))}
          </SwipeDeck>
          {/* Цэг нь гулсах зай БАЙГАА үед л гарна. */}
          <SwipeDots count={planPages} index={planIdx} onSelect={setPlanIdx} tone="light" className="mt-1" />
        </>
      )}

      <p className="mt-4 text-center text-[13px] leading-relaxed text-[#E2E4E8]">
        Банкны шилжүүлгээр төлнө. Төлбөр баталгаажмагц 5 минутад эрх идэвхжинэ.
        Яаралтай бол {SUPPORT_PHONE} руу залгана уу.
      </p>

      <div className="mx-auto mt-10 max-w-2xl border-t border-[#1E1E1E] pt-6">
        <div className="chrome mb-2 text-[11px] font-bold tracking-[0.18em] text-[#E2E4E8]">
          НӨХЦӨЛ, ЖУРАМ
        </div>
        <p className="text-[13px] leading-[1.7] text-[#E2E4E8]">{TERMS_TEXT}</p>
      </div>

    </main>
  );
}

/* ─── Хуулах харилцан үйлдэл ─────────────────────────────────────────────
   Өмнө нь мөр бүрийн ард `[ХУУЛАХ]` гэсэн дүүрэн товч зогсдог байсан.
   Таван мөр = таван товч = таван "энд дар" гэсэн дуудлага, гэтэл хүн
   тэдгээрийн ГУРВЫГ л дардаг. Товч бүр нүдний анхаарлыг татдаг тул
   утга нь өөрөө (данс, дүн, код) хоёрдугаарт үлддэг байв.

   Одоо утга нь гол, хуулах нь хажуугийн жижиг дүрс. МӨР БҮХЭЛДЭЭ дарагдана
   — хүрэх талбар нь товчнаас ХАМААГҮЙ том. Хуулсны дараа дүрс нь баталгаа
   болж 1.5 секунд солигдоод буцна: энэ бол чимэглэл биш, "болсон уу?"
   гэсэн асуултын цорын ганц хариулт (гар утсанд clipboard харагддаггүй). */

/** Том, гол утга — гүйлгээний утга шиг дэлгэцийн гол тоо. */
function CopyValue({
  value, field, copied, onCopy, className = "", emphasis,
}: {
  value: string;
  field: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
  className?: string;
  emphasis?: boolean;
}) {
  const done = copied === field;
  return (
    <button
      type="button"
      onClick={() => onCopy(value, field)}
      aria-label={`${value} — хуулах`}
      className={`press flex w-full items-center justify-between gap-3 text-left ${className}`}
    >
      <span
        className={`min-w-0 break-all font-mono text-[22px] font-bold leading-none tracking-[0.04em] ${
          emphasis ? "text-[#2E29FF]" : "text-[#F2F2F4]"
        }`}
      >
        {value}
      </span>
      <span
        className={`t-meta flex shrink-0 items-center gap-1.5 font-semibold transition-colors duration-150 ${
          done ? "text-[#F2F2F4]" : "text-[#E2E4E8]"
        }`}
      >
        <Icon name={done ? "check" : "copy"} size={20} />
        {done && <span>Хууллаа</span>}
      </span>
    </button>
  );
}

/** Банкны мэдээллийн мөр — шошго дээр, утга доор, дүрс баруунд. */
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
  const done = copied === field;
  return (
    <button
      type="button"
      onClick={() => onCopy(copyText ?? value, field)}
      aria-label={`${label}: ${value} — хуулах`}
      className="press flex w-full items-center justify-between gap-3 py-[var(--sp-3)] text-left"
    >
      <span className="min-w-0">
        {/* Том үсэггүй: монгол шошгыг жижиг үсгээр бичихэд үгийн хэлбэр
            хадгалагдаж, хурдан танигдана. */}
        <span className="t-meta block text-[#E2E4E8]">{label}</span>
        <span
          className={`block truncate text-[15px] ${mono ? "font-mono tracking-wide" : ""} ${
            highlight ? "font-bold text-[#2E29FF]" : "text-[#F2F2F4]"
          }`}
        >
          {value}
        </span>
      </span>
      <span
        className={`t-meta flex shrink-0 items-center gap-1.5 font-semibold transition-colors duration-150 ${
          done ? "text-[#F2F2F4]" : "text-[#E2E4E8]"
        }`}
      >
        <Icon name={done ? "check" : "copy"} size={16} />
        {done && <span>Хууллаа</span>}
      </span>
    </button>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <PricingInner />
    </Suspense>
  );
}
