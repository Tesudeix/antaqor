"use client";

import { useEffect, useState } from "react";

/* ─── /admin/plans — төлбөрийн картуудыг засах ────────────────────────────
   Юуг засаж БОЛОХГҮЙ вэ гэдэг нь энэ хуудасны гол шийдэл: тарифын `id`
   энд харагдахгүй, солигдохгүй. Учир нь id бол эрхийн систем бүхэлдээ
   түшиглэдэг түлхүүр (PLAN_RANK, курсын requiredPlan, хэрэглэгчийн plan).
   Шинэ id зохиогдвол тэр багц авсан хүн бүх хаалганаас гадуур үлдэнэ.

   Үнэ засахад ЮУ БОЛОХ: /pricing дээрх дүн ба /api/clan/join-ийн үүсгэх
   төлбөрийн дүн хоёулаа энэ утгыг уншина. Аль хэдийн ҮҮССЭН, хүлээгдэж
   буй төлбөрүүд хуучин дүнгээрээ үлдэнэ — тэднийг өөрчилвөл хүн шилжүүлсэн
   дүн нь захиалгатайгаа таарахаа болино. */

interface Plan {
  id: string;
  name: string;
  price: number;
  tagline: string;
  benefits: string[];
  cta: string;
  highlight?: boolean;
  accent: string;
  order: number;
  active: boolean;
}

const FIELD =
  "w-full rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] text-white placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]";
const LABEL = "chrome mb-1.5 block text-[10px] font-bold tracking-[0.14em] text-[#E2E4E8]";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.plans)) setPlans(d.plans);
        else setError(d?.error || "Ачаалж чадсангүй");
      })
      .catch(() => setError("Ачаалж чадсангүй"))
      .finally(() => setLoading(false));
  }, []);

  const patch = (id: string, field: keyof Plan, value: unknown) => {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const save = async (plan: Plan) => {
    setSavingId(plan.id);
    setError("");
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          name: plan.name,
          price: Number(plan.price),
          tagline: plan.tagline,
          benefits: plan.benefits,
          cta: plan.cta,
          highlight: plan.highlight,
          accent: plan.accent,
          order: plan.order,
          active: plan.active,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d?.error || "Хадгалж чадсангүй");
        return;
      }
      if (Array.isArray(d?.plans)) setPlans(d.plans);
      setSavedId(plan.id);
      window.setTimeout(() => setSavedId(null), 1800);
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-24 pt-8">
      <div className="chrome mb-2 flex items-center gap-2 text-[11px] font-bold">
        <span className="text-[#2E29FF]">ТӨЛБӨР</span>
        <span className="text-[#E2E4E8]">ТАРИФЫН КАРТ</span>
      </div>
      <h1 className="headline text-[clamp(22px,3.6vw,30px)]">Тарифын картууд</h1>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[#E2E4E8]">
        Эндээс /pricing дээрх карт бүрийн нэр, үнэ, тайлбар, эрхийн жагсаалт,
        товчны бичиг, дараалал, зарагдах эсэхийг өөрчилнө. Үнэ өөрчлөхөд
        худалдан авалтын дүн ч хамт өөрчлөгдөнө — өмнө үүссэн, хүлээгдэж буй
        төлбөрүүд хуучин дүнгээрээ үлдэнэ.
      </p>

      {error && (
        <div className="mt-5 rounded-[4px] bg-[rgba(46,41,255,0.12)] px-4 py-3 text-[13px] text-[#4C47FF]">
          {error}
        </div>
      )}

      <div className="mt-8 flex flex-col gap-5">
        {plans.map((plan) => (
          <section key={plan.id} className="bg-[#0A0A0A] p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="chrome bg-[#1E1E1E] px-2 py-1 text-[10px] font-bold tracking-[0.14em] text-[#E2E4E8]">
                  {plan.id}
                </span>
                {plan.highlight && (
                  <span className="bg-[#2E29FF] px-2 py-1 text-[10px] font-bold text-white">
                    ★ САНАЛ БОЛГОХ
                  </span>
                )}
                {!plan.active && (
                  <span className="bg-[#262626] px-2 py-1 text-[10px] font-bold text-[#E2E4E8]">
                    ЗАРАГДАХГҮЙ
                  </span>
                )}
              </div>
              <button
                onClick={() => save(plan)}
                disabled={savingId === plan.id}
                className="h-10 shrink-0 bg-[#2E29FF] px-5 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
              >
                {savingId === plan.id ? "..." : savedId === plan.id ? "Хадгаллаа ✓" : "Хадгалах"}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>НЭР</label>
                <input className={FIELD} value={plan.name} onChange={(e) => patch(plan.id, "name", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>ҮНЭ (₮ / САР)</label>
                <input
                  className={FIELD}
                  type="number"
                  min={0}
                  value={plan.price}
                  onChange={(e) => patch(plan.id, "price", e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>ТАЙЛБАР</label>
                <input className={FIELD} value={plan.tagline} onChange={(e) => patch(plan.id, "tagline", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>ТОВЧНЫ БИЧИГ</label>
                <input className={FIELD} value={plan.cta} onChange={(e) => patch(plan.id, "cta", e.target.value)} />
              </div>
              <div>
                <label className={LABEL}>ДАРААЛАЛ</label>
                <input
                  className={FIELD}
                  type="number"
                  value={plan.order}
                  onChange={(e) => patch(plan.id, "order", Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>ЭРХҮҮД — МӨР ТУС БҮР НЭГ</label>
                <textarea
                  className={`${FIELD} resize-y`}
                  rows={6}
                  value={plan.benefits.join("\n")}
                  onChange={(e) => patch(plan.id, "benefits", e.target.value.split("\n"))}
                />
                <p className="mt-1.5 text-[11px] text-[#E2E4E8]">
                  Хоосон мөр хадгалахад автоматаар хасагдана. Дээд тал нь 12.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-5 border-t border-[#1E1E1E] pt-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#E2E4E8]">
                <input
                  type="checkbox"
                  checked={!!plan.highlight}
                  onChange={(e) => patch(plan.id, "highlight", e.target.checked)}
                  className="h-4 w-4 accent-[#2E29FF]"
                />
                Онцлох карт
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#E2E4E8]">
                <input
                  type="checkbox"
                  checked={plan.active}
                  onChange={(e) => patch(plan.id, "active", e.target.checked)}
                  className="h-4 w-4 accent-[#2E29FF]"
                />
                Зарагдана
              </label>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
