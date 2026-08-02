"use client";

// Yuki booking flow — Service → Location → Stylist → Time → Confirm.
// Light theme (white surfaces, pink accents). Mobile-first. Each step is
// one screen and auto-advances on selection, so the path-to-booking is the
// shortest possible (one tap per decision).

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── Pink-on-white palette ──────────────────────────────────────────────
const PINK = "#EC4899";
const PINK_SOFT = "#FBCFE8";
const PINK_DEEP = "#BE185D";
const PINK_TINT = "#FDF2F8";
const INK = "#2A1B2A";
const SUB = "#5C4A5A";
const DIM = "#94889A";
const BORDER = "#F1E3EC";

// ─── Types ──────────────────────────────────────────────────────────────
interface Service { _id: string; name: string; description?: string; durationMin: number; priceMnt: number; image?: string; }
interface Location { _id: string; name: string; address: string; city?: string; district?: string; phone?: string; image?: string; mapUrl?: string; }
interface Stylist { _id: string; name: string; role?: string; avatar?: string; services: string[]; location?: string; }

type Step = 1 | 2 | 3 | 4 | 5 | 6; // 6 = confirmed

// ─── Page wrapper (Suspense for useSearchParams) ────────────────────────
export default function YukiBookPage() {
  return (
    <Suspense fallback={null}>
      <YukiBookFlow />
    </Suspense>
  );
}

function YukiBookFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, status: authStatus } = useSession();

  // ─── Step state ─────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ─── Data ────────────────────────────────────────────────────────────
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);

  // ─── Selections ──────────────────────────────────────────────────────
  const [serviceId, setServiceId] = useState<string | null>(params.get("service"));
  const [locationId, setLocationId] = useState<string | null>(params.get("location"));
  const [stylistId, setStylistId] = useState<string | null>(params.get("stylist"));
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [slotIso, setSlotIso] = useState<string | null>(null);

  // ─── Form ────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<null | {
    id: string; startsAt: string; service: string; stylist: string;
    locationName?: string; locationAddress?: string; priceMnt: number;
  }>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/yuki/services").then((r) => r.json()).then((d) => setServices(d.services || [])).catch(() => {});
    fetch("/api/yuki/locations").then((r) => r.json()).then((d) => setLocations(d.locations || [])).catch(() => {});
    fetch("/api/yuki/stylists").then((r) => r.json()).then((d) => setStylists(d.stylists || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session]);

  // Auto-skip forward when a selection arrives via URL.
  useEffect(() => {
    if (serviceId && step === 1) setStep(2);
  }, [serviceId, step]);

  // Filter stylists by chosen service + location.
  const service = services.find((s) => s._id === serviceId) || null;
  const location = locations.find((l) => l._id === locationId) || null;
  const stylist = stylists.find((s) => s._id === stylistId) || null;

  const eligibleStylists = useMemo(() => {
    let pool = stylists;
    if (serviceId) pool = pool.filter((s) => s.services.includes(serviceId));
    if (locationId) pool = pool.filter((s) => !s.location || s.location === locationId);
    return pool;
  }, [stylists, serviceId, locationId]);

  const submitBooking = async () => {
    if (!service || !stylist || !slotIso) return;
    if (authStatus !== "authenticated") {
      const cb = `/yuki/book?service=${service._id}&location=${locationId || ""}&stylist=${stylist._id}`;
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(cb)}`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/yuki/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: service._id,
          stylist: stylist._id,
          location: locationId || null,
          startsAt: slotIso,
          customerName: name,
          contactPhone: phone,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Захиалга үүсгэхэд алдаа");
        return;
      }
      setConfirmation({
        id: data.booking._id,
        startsAt: data.booking.startsAt,
        service: data.booking.service.name,
        stylist: data.booking.stylist.name,
        locationName: location?.name,
        locationAddress: location?.address,
        priceMnt: data.booking.service.priceMnt,
      });
      setStep(6);
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[640px] px-5 pb-32 pt-5 sm:px-6 lg:pt-9">
      {/* ─── Top bar ─── */}
      <header className="mb-5 flex items-center justify-between">
        <Link href="/yuki" className="inline-flex items-center gap-1.5 text-[12px] font-bold transition" style={{ color: DIM }}>
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          YUKI
        </Link>
        <Stepper step={step} />
      </header>

      {step === 6 && confirmation ? (
        <ConfirmationView c={confirmation} />
      ) : (
        <>
          {step === 1 && (
            <StepShell title="Үйлчилгээ" subtitle="Юу хийлгэх вэ?">
              {services.length === 0 ? (
                <Empty>Үйлчилгээ бэлдэж байна…</Empty>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <ServiceRow
                      key={s._id}
                      service={s}
                      selected={s._id === serviceId}
                      onClick={() => { setServiceId(s._id); setStylistId(null); setStep(2); }}
                    />
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {step === 2 && (
            <StepShell title="Салбар" subtitle="Хаана ирэх вэ?" onBack={() => setStep(1)}>
              {locations.length === 0 ? (
                <Empty>Салбар бэлдэж байна…</Empty>
              ) : (
                <div className="space-y-2">
                  {locations.map((l) => (
                    <LocationRow
                      key={l._id}
                      location={l}
                      selected={l._id === locationId}
                      onClick={() => { setLocationId(l._id); setStylistId(null); setStep(3); }}
                    />
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {step === 3 && (
            <StepShell title="Мастер" subtitle={location ? `${location.name} · ${service?.name || ""}` : "Хэн чамайг угтах вэ?"} onBack={() => setStep(2)}>
              {eligibleStylists.length === 0 ? (
                <Empty>Энэ салбарт энэ үйлчилгээний мастер байхгүй.</Empty>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {eligibleStylists.map((s) => (
                    <StylistTile
                      key={s._id}
                      stylist={s}
                      selected={s._id === stylistId}
                      onClick={() => { setStylistId(s._id); setStep(4); }}
                    />
                  ))}
                </div>
              )}
            </StepShell>
          )}

          {step === 4 && service && stylist && (
            <StepShell title="Цаг" subtitle={`${service.name} · ${stylist.name}`} onBack={() => setStep(3)}>
              <SlotPicker
                stylistId={stylist._id}
                serviceId={service._id}
                dateStr={dateStr}
                onDateChange={setDateStr}
                slotIso={slotIso}
                onSlotChange={(iso) => { setSlotIso(iso); setStep(5); }}
              />
            </StepShell>
          )}

          {step === 5 && service && stylist && slotIso && (
            <StepShell title="Баталгаажуулах" subtitle="Бүгд зөв үү?" onBack={() => setStep(4)}>
              <BookingSummary service={service} stylist={stylist} location={location} slotIso={slotIso} />
              <div className="mt-5 space-y-3">
                <Field label="Нэр" value={name} onChange={setName} placeholder="Бат" />
                <Field label="Утас" value={phone} onChange={setPhone} placeholder="9911-XXXX" />
                <Field label="Тэмдэглэл" textarea value={notes} onChange={setNotes} placeholder="Мастерт хэлэх юм бий бол" />
              </div>
              {error && (
                <div
                  className="mt-4 rounded-none border px-3 py-2 text-[12px]"
                  style={{ borderColor: "#8FC1EA", background: "#FEF2F2", color: "#9F1239" }}
                >
                  {error}
                </div>
              )}
              {authStatus !== "authenticated" ? (
                <button
                  type="button"
                  onClick={submitBooking}
                  className="mt-5 w-full rounded-full py-3.5 text-[14px] font-black text-white transition hover:scale-[1.01]"
                  style={{ background: PINK, boxShadow: `0 12px 28px rgba(236,72,153,0.32)` }}
                >
                  Нэвтэрч баталгаажуулах
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitBooking}
                  disabled={submitting || !name.trim() || !phone.trim()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-black text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: PINK, boxShadow: `0 12px 28px rgba(236,72,153,0.32)` }}
                >
                  {submitting ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Баталгаажуулж байна…
                    </>
                  ) : (
                    "Захиалга баталгаажуулах"
                  )}
                </button>
              )}
            </StepShell>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stepper — N dashes that fill in as you progress ────────────────────
function Stepper({ step }: { step: Step }) {
  // Hide once confirmed (step 6) — the success state speaks for itself.
  if (step === 6) return null;
  const total = 5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <div
            key={i}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: active ? 22 : done ? 14 : 10,
              background: done ? PINK_DEEP : active ? PINK : "#F1E3EC",
              boxShadow: active ? `0 0 10px ${PINK}55` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── StepShell — title, subtitle, back link, body ──────────────────────
function StepShell({
  title, subtitle, children, onBack,
}: { title: string; subtitle: string; children: React.ReactNode; onBack?: () => void }) {
  return (
    <div>
      <div className="mb-5">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] transition"
            style={{ color: DIM }}
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            БУЦАХ
          </button>
        )}
        <h1 className="text-[26px] font-black tracking-tight sm:text-[32px]" style={{ color: INK }}>
          {title}
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: SUB }}>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-none border border-dashed py-10 text-center"
      style={{ borderColor: PINK_SOFT, background: PINK_TINT }}
    >
      <p className="text-[13px]" style={{ color: DIM }}>{children}</p>
    </div>
  );
}

// ─── Step rows ──────────────────────────────────────────────────────────
function ServiceRow({ service, selected, onClick }: { service: Service; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-none border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(236,72,153,0.12)]"
      style={{ borderColor: selected ? PINK : BORDER }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-mono text-[14px] font-black"
        style={{ background: PINK_TINT, color: PINK_DEEP }}
      >
        {/* Eyelash glyph stand-in — keeps the rows compact when no image */}
        {service.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={service.image} alt="" className="h-full w-full rounded-full object-cover" />
        ) : (
          "✦"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-[14px] font-black" style={{ color: INK }}>{service.name}</h3>
          <span className="shrink-0 font-mono text-[12px] font-bold tabular-nums" style={{ color: PINK_DEEP }}>
            ₮{service.priceMnt.toLocaleString()}
          </span>
        </div>
        {service.description && (
          <p className="mt-0.5 line-clamp-1 text-[11px]" style={{ color: DIM }}>
            {service.description}
          </p>
        )}
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: DIM }}>
          {service.durationMin} мин
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" fill="none" stroke={PINK} strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function LocationRow({ location, selected, onClick }: { location: Location; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-stretch gap-3 overflow-hidden rounded-none border bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(236,72,153,0.12)]"
      style={{ borderColor: selected ? PINK : BORDER }}
    >
      <div
        className="h-[88px] w-[88px] shrink-0 overflow-hidden"
        style={{ background: PINK_TINT }}
      >
        {location.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={location.image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg className="h-6 w-6" fill="none" stroke={PINK} strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 py-3 pr-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-[14px] font-black" style={{ color: INK }}>{location.name}</h3>
          {location.district && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.18em]"
              style={{ background: PINK_TINT, color: PINK_DEEP }}
            >
              {location.district}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px]" style={{ color: SUB }}>
          {location.address}
        </p>
        {location.phone && (
          <p className="mt-0.5 font-mono text-[10px]" style={{ color: DIM }}>
            {location.phone}
          </p>
        )}
      </div>
      <svg className="my-auto mr-3 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" fill="none" stroke={PINK} strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// Compact IG-story sized stylist tile — same scale as the home row.
function StylistTile({ stylist, selected, onClick }: { stylist: Stylist; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 text-center transition"
    >
      <div
        className="relative aspect-square w-full rounded-none p-[2px]"
        style={{
          background: selected
            ? `linear-gradient(135deg, ${PINK} 0%, ${PINK_DEEP} 100%)`
            : `conic-gradient(from 215deg, ${PINK} 0deg, ${PINK_SOFT} 90deg, ${PINK_DEEP} 180deg, ${PINK_SOFT} 270deg, ${PINK} 360deg)`,
          boxShadow: selected ? `0 8px 22px rgba(236,72,153,0.35)` : `0 4px 12px rgba(236,72,153,0.15)`,
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-none" style={{ background: PINK_TINT }}>
          {stylist.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={stylist.avatar} alt={stylist.name} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.05]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[24px] font-black" style={{ color: PINK_SOFT }}>
              {stylist.name.charAt(0)}
            </div>
          )}
          {selected && (
            <span
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white"
              style={{ background: PINK, boxShadow: `0 0 0 2px white` }}
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>
      </div>
      <div className="w-full px-0.5 leading-tight">
        <div className="truncate text-[12px] font-black" style={{ color: INK }}>{stylist.name}</div>
        {stylist.role && (
          <div className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: PINK }}>
            {stylist.role}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Slot picker ────────────────────────────────────────────────────────
function SlotPicker({
  stylistId, serviceId, dateStr, onDateChange, slotIso, onSlotChange,
}: {
  stylistId: string; serviceId: string;
  dateStr: string | null; onDateChange: (d: string) => void;
  slotIso: string | null; onSlotChange: (iso: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<string[]>([]);
  const [reason, setReason] = useState<string | null>(null);

  const dates = useMemo(() => {
    const out: { iso: string; label: string; sub: string }[] = [];
    const now = new Date();
    const days = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      out.push({
        iso,
        label: i === 0 ? "Өнөөдөр" : i === 1 ? "Маргааш" : days[d.getDay()],
        sub: `${dd}.${mm}`,
      });
    }
    return out;
  }, []);

  useEffect(() => {
    if (!dateStr && dates[0]) onDateChange(dates[0].iso);
  }, [dateStr, dates, onDateChange]);

  useEffect(() => {
    if (!dateStr) return;
    setLoading(true);
    setSlots([]);
    setReason(null);
    fetch(`/api/yuki/availability?stylist=${stylistId}&service=${serviceId}&date=${dateStr}`)
      .then((r) => r.json())
      .then((d) => {
        setSlots(d.slots || []);
        if (d.reason) setReason(d.reason);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stylistId, serviceId, dateStr]);

  return (
    <div>
      <div className="-mx-2 mb-4 flex gap-1.5 overflow-x-auto px-2 scrollbar-hide">
        {dates.map((d) => {
          const active = d.iso === dateStr;
          return (
            <button
              key={d.iso}
              type="button"
              onClick={() => onDateChange(d.iso)}
              className="shrink-0 rounded-none border px-3 py-2 text-center transition"
              style={{
                borderColor: active ? PINK : BORDER,
                background: active ? PINK_TINT : "white",
              }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: active ? PINK : DIM }}>
                {d.label}
              </div>
              <div className="mt-0.5 font-mono text-[14px] font-black tabular-nums" style={{ color: active ? INK : SUB }}>
                {d.sub}
              </div>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: PINK }} />
        </div>
      ) : reason === "closed" ? (
        <Empty>Энэ өдөр мастер амарч байна.</Empty>
      ) : slots.length === 0 ? (
        <Empty>Боломжтой цаг үлдсэнгүй. Өөр өдөр сонгоно уу.</Empty>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((iso) => {
            const d = new Date(iso);
            const label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const active = iso === slotIso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => onSlotChange(iso)}
                className="rounded-none border py-2.5 font-mono text-[14px] font-black tabular-nums transition"
                style={{
                  borderColor: active ? PINK : BORDER,
                  background: active ? PINK : "white",
                  color: active ? "white" : INK,
                  boxShadow: active ? `0 6px 18px rgba(236,72,153,0.35)` : undefined,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Summary card ───────────────────────────────────────────────────────
function BookingSummary({
  service, stylist, location, slotIso,
}: { service: Service; stylist: Stylist; location: Location | null; slotIso: string }) {
  const d = new Date(slotIso);
  const dateLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const timeLabel = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return (
    <div className="rounded-none border bg-white p-4" style={{ borderColor: PINK_SOFT }}>
      <div className="flex items-center gap-3 border-b pb-3" style={{ borderColor: BORDER }}>
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full p-[2px]"
          style={{ background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DEEP} 100%)` }}
        >
          <div className="h-full w-full overflow-hidden rounded-full" style={{ background: PINK_TINT }}>
            {stylist.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={stylist.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[14px] font-black" style={{ color: PINK_DEEP }}>
                {stylist.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-black" style={{ color: INK }}>{stylist.name}</div>
          {stylist.role && (
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: PINK }}>
              {stylist.role}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2 pt-3">
        <Row label="Үйлчилгээ" value={service.name} />
        <Row label="Үргэлжлэх" value={`${service.durationMin} мин`} />
        {location && <Row label="Салбар" value={location.name} />}
        {location?.address && <Row label="Хаяг" value={location.address} small />}
        <Row label="Огноо" value={dateLabel} />
        <Row label="Цаг" value={timeLabel} />
        <Row label="Үнэ" value={`₮${service.priceMnt.toLocaleString()}`} accent />
      </div>
    </div>
  );
}

function Row({ label, value, accent, small }: { label: string; value: string; accent?: boolean; small?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>{label}</span>
      <span
        className={`${small ? "text-[11px]" : "text-[13px]"} font-bold tabular-nums text-right`}
        style={{ color: accent ? PINK_DEEP : INK }}
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: DIM }}>
        {label}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full resize-y rounded-none border bg-white px-3 py-2.5 text-[13px] outline-none transition"
          style={{ borderColor: BORDER, color: INK }}
          onFocus={(e) => (e.currentTarget.style.borderColor = PINK)}
          onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-none border bg-white px-3 py-2.5 text-[13px] outline-none transition"
          style={{ borderColor: BORDER, color: INK }}
          onFocus={(e) => (e.currentTarget.style.borderColor = PINK)}
          onBlur={(e) => (e.currentTarget.style.borderColor = BORDER)}
        />
      )}
    </label>
  );
}

// ─── Confirmation ───────────────────────────────────────────────────────
function ConfirmationView({ c }: { c: { id: string; startsAt: string; service: string; stylist: string; locationName?: string; locationAddress?: string; priceMnt: number } }) {
  const d = new Date(c.startsAt);
  const dateLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const timeLabel = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return (
    <div className="text-center">
      <div
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DEEP} 100%)`,
          boxShadow: `0 16px 40px rgba(236,72,153,0.35)`,
        }}
      >
        <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-[26px] font-black sm:text-[32px]" style={{ color: INK }}>
        Захиалга баталгаажлаа
      </h1>
      <p className="mt-1.5 text-[13px]" style={{ color: DIM }}>Уулзахдаа баяртай байна.</p>
      <div
        className="mx-auto mt-6 max-w-[420px] rounded-none border bg-white p-5 text-left"
        style={{ borderColor: PINK_SOFT }}
      >
        <Row label="Захиалгын ID" value={c.id.slice(-8).toUpperCase()} />
        <Row label="Үйлчилгээ" value={c.service} />
        <Row label="Мастер" value={c.stylist} />
        {c.locationName && <Row label="Салбар" value={c.locationName} />}
        {c.locationAddress && <Row label="Хаяг" value={c.locationAddress} small />}
        <Row label="Огноо" value={dateLabel} />
        <Row label="Цаг" value={timeLabel} />
        <Row label="Үнэ" value={`₮${c.priceMnt.toLocaleString()}`} accent />
      </div>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/yuki/me"
          className="rounded-full px-5 py-2.5 text-[12px] font-bold transition hover:bg-[#FDF2F8]"
          style={{ color: PINK_DEEP, border: `1px solid ${PINK_SOFT}` }}
        >
          Миний захиалга
        </Link>
        <Link
          href="/yuki"
          className="rounded-full px-5 py-2.5 text-[12px] font-black text-white transition hover:scale-[1.02]"
          style={{ background: PINK, boxShadow: `0 8px 20px rgba(236,72,153,0.32)` }}
        >
          Эхэндээ буцах
        </Link>
      </div>
    </div>
  );
}
