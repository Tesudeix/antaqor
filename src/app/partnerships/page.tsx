"use client";

import { useEffect, useState } from "react";

interface PricingData {
  paidMembers: number;
}

const PARTNER_TYPES = [
  {
    key: "brand",
    emoji: "🎯",
    title: "Бренд / Ивээн тэтгэгч",
    desc: "Монголын хамгийн идэвхтэй дижитал бүтээгчдийн өмнө брендээ танилцуул. Эвент, контент, хичээл доторх integration.",
  },
  {
    key: "education",
    emoji: "🎓",
    title: "Боловсролын хамтрагч",
    desc: "Хичээл, сургалтаа Antaqor Classroom дээр байршуулж, бэлэн үзэгчдэд хүргэ. Орлогоо хуваан хүртэх загвар.",
  },
  {
    key: "tech",
    emoji: "⚙️",
    title: "Технологи / Affiliate",
    desc: "AI хэрэгсэл, SaaS, API нэгтгэл. Хамтарсан давуу эрх, affiliate комисс, хамтарсан бүтээгдэхүүн.",
  },
  {
    key: "community",
    emoji: "🤝",
    title: "Нийгэмлэг / Эвент",
    desc: "Хамтарсан арга хэмжээ, hackathon, meetup. Хоёр талын үзэгчдийг холбож, нөлөөгөө хэдэн дахин нэмэгдүүл.",
  },
];

const BENEFITS = [
  { stat: "AI-first", label: "Монголын анхдагч AI бүтээгчдийн нийгэмлэг" },
  { stat: "Идэвхтэй", label: "Өдөр бүр контент бүтээдэг гишүүдийн бааз" },
  { stat: "Хэмжих", label: "Тодорхой ROI, ил тод тайлан" },
];

const FAQ = [
  {
    q: "Хамтрах хамгийн бага хэмжээ хэд вэ?",
    a: "Бид уян хатан загвартай. Багахан pilot integration-оос эхлээд урт хугацааны стратегийн түншлэл хүртэл боломжтой. Таны зорилгод тааруулна.",
  },
  {
    q: "Хариу хэр хурдан өгдөг вэ?",
    a: "Хүсэлт илгээснээс хойш 1–2 ажлын өдөрт холбогдож, дэлгэрэнгүй ярилцлага товлоно.",
  },
  {
    q: "Орлого хуваах загвар яаж ажилладаг вэ?",
    a: "Боловсрол болон affiliate хамтрагчдад орлого хуваах (revenue share) тодорхой хувьтай гэрээ байгуулна. Нөхцөлийг ярилцлагын үеэр тохирно.",
  },
];

function formatMNT(n: number) {
  return n.toLocaleString("mn-MN");
}

export default function PartnershipsPage() {
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [form, setForm] = useState({
    company: "",
    name: "",
    email: "",
    phone: "",
    type: "brand",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => { if (typeof d.paidMembers === "number") setPricing(d); })
      .catch(() => {});
  }, []);

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/partnerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error || "Алдаа гарлаа. Дахин оролдоно уу.");
      }
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      {/* Hero */}
      <section className="text-center">
        <span className="inline-block rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[2px] text-[#1080CA]">
          Хамтрах
        </span>
        <h1 className="mt-5 text-[34px] font-bold leading-[1.1] tracking-tight text-[#0e1726] sm:text-[44px]">
          Антакортой <span className="text-[#1080CA]">хамтран</span> өсцгөөе
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#8a8a82]">
          Antaqor бол Монголын AI бүтээгчдийн дижитал үндэстэн. Брендүүд, сургалтын
          байгууллагууд, технологийн компаниудтай хамтран бүтээгчдэд бодит үнэ цэн нэмнэ.
        </p>
        <a
          href="#form"
          className="mt-7 inline-block rounded-none bg-[#1080CA] px-7 py-3 text-[13px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.3)]"
        >
          Хамтрах хүсэлт илгээх
        </a>
      </section>

      {/* Stats */}
      <section className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-4 text-center">
          <div className="text-[24px] font-bold leading-none text-[#FFD300]">
            {pricing ? formatMNT(pricing.paidMembers) : "—"}
          </div>
          <div className="mt-1.5 text-[11px] text-[#6b7280]">Төлбөртэй гишүүн</div>
        </div>
        {BENEFITS.slice(0, 2).map((b) => (
          <div key={b.label} className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-4 text-center">
            <div className="text-[18px] font-bold leading-tight text-[#0e1726]">{b.stat}</div>
            <div className="mt-1.5 text-[11px] leading-snug text-[#6b7280]">{b.label}</div>
          </div>
        ))}
      </section>

      {/* Partner types */}
      <section className="mt-14">
        <h2 className="text-[20px] font-bold tracking-tight text-[#0e1726]">Хамтрах хэлбэрүүд</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PARTNER_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setForm((f) => ({ ...f, type: t.key }));
                document.getElementById("form")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="group rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-5 text-left transition hover:border-[rgba(16,128,202,0.4)]"
            >
              <div className="text-[26px]">{t.emoji}</div>
              <h3 className="mt-3 text-[15px] font-bold text-[#0e1726]">{t.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#6b7280]">{t.desc}</p>
              <span className="mt-3 inline-block text-[12px] font-semibold text-[#1080CA] opacity-0 transition group-hover:opacity-100">
                Сонгох →
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Why partner */}
      <section className="mt-14 rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-6">
        <h2 className="text-[20px] font-bold tracking-tight text-[#0e1726]">Яагаад Antaqor?</h2>
        <div className="mt-5 space-y-4">
          {[
            { t: "Зорилтот үзэгчид", d: "Ерөнхий олонд биш — AI-д суралцаж буй идэвхтэй, төлбөр төлдөг бүтээгчдэд шууд хүрнэ." },
            { t: "Бодит integration", d: "Зүгээр баннер биш. Хичээл, эвент, AI хэрэгсэл доторх жинхэнэ үнэ цэнтэй холболт." },
            { t: "Ил тод тайлан", d: "Хүрсэн хүн, оролцоо, хөрвөлтийн тоог ил тод хэмжиж, хамтын ROI-г харна." },
          ].map((row) => (
            <div key={row.t} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1080CA]" />
              <div>
                <div className="text-[14px] font-semibold text-[#0e1726]">{row.t}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed text-[#6b7280]">{row.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section id="form" className="mt-14 scroll-mt-20">
        <h2 className="text-[20px] font-bold tracking-tight text-[#0e1726]">Хүсэлт илгээх</h2>
        <p className="mt-1.5 text-[13px] text-[#6b7280]">1–2 ажлын өдөрт хариу өгнө.</p>

        {done ? (
          <div className="mt-6 rounded-none border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.06)] p-8 text-center">
            <div className="text-[32px]">✓</div>
            <div className="mt-2 text-[16px] font-bold text-[#0e1726]">Хүсэлт хүлээн авлаа</div>
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Бид удахгүй таны имэйлээр холбогдоно.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.company}
                onChange={update("company")}
                placeholder="Байгууллага (заавал биш)"
                className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] text-[#0e1726] outline-none transition placeholder:text-[#4a4a55] focus:border-[rgba(16,128,202,0.5)]"
              />
              <input
                required
                value={form.name}
                onChange={update("name")}
                placeholder="Таны нэр *"
                className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] text-[#0e1726] outline-none transition placeholder:text-[#4a4a55] focus:border-[rgba(16,128,202,0.5)]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                type="email"
                value={form.email}
                onChange={update("email")}
                placeholder="Имэйл *"
                className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] text-[#0e1726] outline-none transition placeholder:text-[#4a4a55] focus:border-[rgba(16,128,202,0.5)]"
              />
              <input
                value={form.phone}
                onChange={update("phone")}
                placeholder="Утас (заавал биш)"
                className="rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] text-[#0e1726] outline-none transition placeholder:text-[#4a4a55] focus:border-[rgba(16,128,202,0.5)]"
              />
            </div>
            <select
              value={form.type}
              onChange={update("type")}
              className="w-full rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] text-[#0e1726] outline-none transition focus:border-[rgba(16,128,202,0.5)]"
            >
              {PARTNER_TYPES.map((t) => (
                <option key={t.key} value={t.key} className="bg-[#f7f9fb]">{t.title}</option>
              ))}
              <option value="other" className="bg-[#f7f9fb]">Бусад</option>
            </select>
            <textarea
              required
              value={form.message}
              onChange={update("message")}
              placeholder="Хамтрах саналаа товч бичнэ үү *"
              rows={5}
              className="w-full resize-none rounded-none border border-[#F2F2F4] bg-[#f7f9fb] px-4 py-3 text-[14px] leading-relaxed text-[#0e1726] outline-none transition placeholder:text-[#4a4a55] focus:border-[rgba(16,128,202,0.5)]"
            />
            {error && <p className="text-[13px] text-[#1080CA]">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-none bg-[#1080CA] px-6 py-3.5 text-[14px] font-bold text-[#0E0E10] transition hover:shadow-[0_0_24px_rgba(16,128,202,0.3)] disabled:opacity-50"
            >
              {submitting ? "Илгээж байна..." : "Хүсэлт илгээх"}
            </button>
          </form>
        )}
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-[20px] font-bold tracking-tight text-[#0e1726]">Түгээмэл асуултууд</h2>
        <div className="mt-4 divide-y divide-[#F2F2F4] rounded-none border border-[#F2F2F4] bg-[#f7f9fb]">
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="text-[14px] font-semibold text-[#0e1726]">{item.q}</span>
                <span className={`text-[#6b7280] transition ${openFaq === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {openFaq === i && (
                <p className="px-5 pb-4 text-[13px] leading-relaxed text-[#6b7280]">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
