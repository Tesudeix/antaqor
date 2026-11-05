"use client";

import { useEffect, useState } from "react";

/* ─── ХӨТӨЛБӨРИЙН БҮРЭЛДЭХҮҮН ──────────────────────────────────────────
   ANTAQOR UX/UI Playbook v1.0-ийн дагуу: цагаан гадаргуу, 1px #DEE7E7
   хүрээ, идэвхтэй төлөвт зөөлөн mint, ганц teal CTA, ≥44px хүрэх бай.

   Хоёр бүрэлдэхүүн НЭГ файлд байгаа шалтгаан: `Program` төрөл болон
   татах логикоо хуваалцдаг. Тусад нь салгавал тэр хоёрыг хоёр газар
   тавих ба нэгийг нь засахад нөгөө нь хоцорно.

   РАДИУС: playbook карт `8–12px`, товч `8px` гэж заасан тул ЭНД тийм
   байна. Сайтын бусад хэсэг 4px — энэ зөрүүг эзэн шийдэх хүртэл
   playbook-ийн заасныг баримтлав. */

export interface Program {
  slug: string;
  code: string;
  title: string;
  kicker: string;
  audience: string;
  scheduleDays: string;
  scheduleTime: string;
  summary: string;
  lessonCount: number;
  stats: { value: string; label: string }[];
  takeaway: string;
  bullets: string[];
  accent: string;
}

/* 2026-10-01: сайт харанхуй болсон тул playbook-ийн ЦАГААН токенуудыг
   орлуулав. Утга бүр #0A0A0A суурин дээр хэмжигдсэн:
   ink 17.32:1 · sub 7.12:1 · accent 5.04:1 — бүгд AA давсан.
   Өмнөх цагаан утгууд (#161B1D ink гэх мэт) харанхуй дээр 1.11:1
   болж бүрэн алга болсон. */
const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const MINT = "rgba(46,41,255,0.12)";
const TEAL_DARK = "var(--accent-ink, #2E29FF)";
const SURFACE = "var(--t-surface, #141414)";

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/programs")
      .then((r) => (r.ok ? r.json() : { programs: [] }))
      .then((d) => { if (alive) setPrograms(Array.isArray(d.programs) ? d.programs : []); })
      .catch(() => { if (alive) setPrograms([]); });
    return () => { alive = false; };
  }, []);
  return programs;
}

function ClockIcon() {
  /* Нэг outline гэр бүл, 1.75px stroke, round cap — playbook §4. */
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

/* ═══ 1. СОНГОГЧ — бүртгэл ба нүүр хуудсанд ═══════════════════════════ */
export function ProgramPicker({
  value, onChange, programs, label = "Сонирхож буй хөтөлбөр",
}: {
  value: string;
  onChange: (slug: string) => void;
  programs: Program[] | null;
  label?: string;
}) {
  if (programs === null) {
    return <div className="h-[132px] animate-pulse rounded-[4px]" style={{ background: MINT }} aria-hidden />;
  }
  if (!programs.length) return null;

  /* ГАНЦ ХӨТӨЛБӨР БОЛ СОНГОЛТ БИШ. Нэг сонголттой радио бол хэрэглэгчээс
     утгагүй үйлдэл нэхэж буй хэрэг — автоматаар сонгоод мэдэгдэл болгон
     харуулна. Хоёр болмогц сонгогч өөрөө буцаж ирнэ. */
  if (programs.length === 1) {
    const p = programs[0];
    if (value !== p.slug) onChange(p.slug);
    return (
      <div className="min-w-0">
        <p className="mb-3 block text-[11px] font-bold uppercase" style={{ color: SUB, letterSpacing: "0.12em" }}>{label}</p>
        <div style={{ padding: "14px 16px", borderRadius: 4, border: "1px solid rgba(46,41,255,0.55)", background: MINT }}>
          <span className="block text-[15px] font-bold" style={{ color: INK }}>{p.title}</span>
          {(p.scheduleDays || p.scheduleTime) && (
            <span className="mt-0.5 block text-[13px]" style={{ color: SUB }}>
              {[p.scheduleDays, p.scheduleTime].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <fieldset className="min-w-0 border-0 p-0" style={{ margin: 0 }}>
      <legend
        className="mb-3 block px-0 text-[11px] font-bold uppercase"
        style={{ color: SUB, letterSpacing: "0.12em" }}
      >
        {label}
      </legend>
      <div className="grid gap-2">
        {programs.map((p) => {
          const on = value === p.slug;
          return (
            <label
              key={p.slug}
              className="flex cursor-pointer items-center gap-3 transition"
              style={{
                minHeight: 44,
                padding: "14px 16px",
                borderRadius: 4,
                border: `1px solid ${on ? "rgba(46,41,255,0.55)" : LINE}`,
                background: on ? MINT : SURFACE,
              }}
            >
              <input
                type="radio"
                name="program"
                value={p.slug}
                checked={on}
                onChange={() => onChange(p.slug)}
                className="sr-only"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold" style={{ color: INK }}>{p.title}</span>
                {(p.scheduleDays || p.scheduleTime) && (
                  <span className="mt-0.5 block truncate text-[13px]" style={{ color: SUB }}>
                    {[p.scheduleDays, p.scheduleTime].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              {/* Өнгө ДАНГААРАА төлөв илэрхийлэхгүй — цагирагны дотор
                  дүүргэлт нь хоёр дахь дохио (playbook §4.5). */}
              <span
                aria-hidden
                className="grid shrink-0 place-content-center rounded-full transition"
                style={{
                  width: 22, height: 22,
                  border: `2px solid ${on ? TEAL_DARK : "rgba(255,255,255,0.28)"}`,
                }}
              >
                {on && <span className="block h-[10px] w-[10px] rounded-full" style={{ background: TEAL_DARK }} />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ═══ 2. ДЭЛГЭРЭНГҮЙ КАРТУУД — зочны нүүр хуудас ══════════════════════ */
export function ProgramShowcase({
  programs, selected, onSelect,
}: {
  programs: Program[] | null;
  selected?: string;
  onSelect?: (slug: string) => void;
}) {
  if (programs === null || !programs.length) return null;

  return (
    <section className="mt-10 px-4 md:mt-14 md:px-8" aria-labelledby="programs-heading">
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase" style={{ color: TEAL_DARK, letterSpacing: "0.12em" }}>
          Хөтөлбөр
        </p>
        <h2 id="programs-heading" className="mt-1.5 text-[24px] font-extrabold leading-[1.25] md:text-[28px]" style={{ color: INK }}>
          {programs.length === 1 ? programs[0].title : "Аль замаар эхлэх вэ?"}
        </h2>
      </div>

      {/* Ганц карт бол хагас багана эзлэхгүй — бүтэн өргөнөөр. */}
      <div className={`grid gap-4 ${programs.length > 1 ? "md:grid-cols-2" : ""}`}>
        {programs.map((p) => {
          const on = selected === p.slug;
          return (
            <article
              key={p.slug}
              className="flex min-w-0 flex-col overflow-hidden"
              style={{
                borderRadius: 4,
                border: `1px solid ${on ? "rgba(46,41,255,0.55)" : LINE}`,
                background: SURFACE,
              }}
            >
              {/* Дээд зурвас — хөтөлбөр бүрийг нэг харцаар ялгана. */}
              <div style={{ height: 4, background: p.accent }} aria-hidden />

              <div className="flex flex-1 flex-col p-5 md:p-6">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase" style={{ color: p.accent, letterSpacing: "0.1em" }}>
                  <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: p.accent }} aria-hidden />
                  {[p.code, p.kicker].filter(Boolean).join(" · ")}
                </p>

                {programs.length > 1 && (
                  <h3 className="mt-3 text-[26px] font-extrabold leading-[1.15] md:text-[30px]" style={{ color: INK }}>{p.title}</h3>
                )}
                {p.audience && <p className="mt-1.5 text-[14px]" style={{ color: SUB }}>{p.audience}</p>}

                {(p.scheduleDays || p.scheduleTime) && (
                  <p
                    className="mt-4 inline-flex items-center gap-2 self-start text-[13px] font-bold"
                    style={{ color: p.accent, background: `${p.accent}14`, border: `1px solid ${p.accent}33`, borderRadius: 4, padding: "9px 12px" }}
                  >
                    <ClockIcon />
                    {[p.scheduleDays, p.scheduleTime].filter(Boolean).join(" · ")}
                  </p>
                )}

                {p.summary && (
                  <p className="mt-4 text-[14px] leading-[1.7]" style={{ color: INK }}>
                    {p.summary}
                    {p.lessonCount > 0 && <> <strong>{p.lessonCount} хичээл.</strong></>}
                  </p>
                )}

                {p.stats.length > 0 && (
                  <dl
                    className="mt-5 grid grid-cols-2 overflow-hidden"
                    style={{ border: `1px solid ${LINE}`, borderRadius: 4 }}
                  >
                    {p.stats.map((st, i) => (
                      <div
                        key={i}
                        className="p-4"
                        style={{
                          borderRight: i % 2 === 0 ? `1px solid ${LINE}` : undefined,
                          borderTop: i >= 2 ? `1px solid ${LINE}` : undefined,
                        }}
                      >
                        <dt className="text-[22px] font-extrabold leading-none" style={{ color: p.accent }}>{st.value}</dt>
                        <dd className="mt-2 text-[12px] leading-[1.5]" style={{ color: SUB }}>{st.label}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {p.takeaway && (
                  <div className="mt-5 p-4" style={{ background: `${p.accent}12`, border: `1px solid ${p.accent}2E`, borderRadius: 4 }}>
                    <p className="text-[10.5px] font-bold uppercase" style={{ color: p.accent, letterSpacing: "0.12em" }}>Танд үлдэх зүйлс</p>
                    <p className="mt-2 text-[15px] font-bold leading-[1.5]" style={{ color: INK }}>{p.takeaway}</p>
                  </div>
                )}

                {p.bullets.length > 0 && (
                  <ul className="mt-5 space-y-2.5 border-t pt-5" style={{ borderColor: LINE }}>
                    {p.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2.5 text-[13.5px] leading-[1.6]" style={{ color: INK }}>
                        <span className="mt-[7px] block h-[7px] w-[7px] shrink-0" style={{ background: p.accent, borderRadius: 2 }} aria-hidden />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}

                {onSelect && (
                  <button
                    type="button"
                    onClick={() => onSelect(p.slug)}
                    aria-pressed={on}
                    className="mt-6 w-full font-bold transition"
                    style={{
                      minHeight: 48, borderRadius: 4, fontSize: 14,
                      background: on ? MINT : "#2E29FF",
                      color: on ? TEAL_DARK : "#0A0A0A",
                      border: on ? `1px solid ${TEAL_DARK}` : "1px solid transparent",
                    }}
                  >
                    {on ? "✓ Сонгосон" : "Энэ хөтөлбөрийг сонгох"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
