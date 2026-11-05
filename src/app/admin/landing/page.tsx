"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Btn, Card, SectionHeader, Spinner, T } from "@/components/admin/kit";
import { LANDING_DEFAULTS, type LandingContentFields } from "@/lib/landingContent";
import { PROGRAM_DAYS } from "@/lib/program";

// ─────────────────────────────────────────────────────────────────────────
// /admin/landing — Нүүр ба Курс хуудасны бүх текстийг эндээс шууд өөрчилнө.
// Хадгалмагц /api/landing-content-ээр хоёр хуудас руу дамжина (60с кэш).
// Талбар хоосон бол код дахь default сэргэнэ — хуудас хэзээ ч цоорхойгүй.
// ─────────────────────────────────────────────────────────────────────────

type Content = LandingContentFields;
type Tab = "home" | "body" | "course" | "days";

import { HOME_SECTION_META } from "@/lib/homeSectionsMeta";
import { HERO_LAYOUTS } from "@/lib/heroLayouts";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Нүүр" },
  { id: "body", label: "Их бие" },
  { id: "course", label: "Курс" },
  { id: "days", label: "7 өдөр" },
];

function Field({
  label,
  hint,
  value,
  onChange,
  rows,
  placeholder,
  type,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  type?: string;
}) {
  const shared =
    "w-full rounded-[4px] border bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#2E29FF]";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E2E4E8]">
        {label}
      </span>
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${shared} resize-y leading-relaxed`}
          style={{ borderColor: T.border }}
        />
      ) : (
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={shared}
          style={{ borderColor: T.border }}
        />
      )}
      {hint && <span className="mt-1 block text-[11px] text-[#E2E4E8]">{hint}</span>}
    </label>
  );
}

/** Мөр бүр = нэг элемент. Жагсаалт талбаруудад хамгийн энгийн засварлагч. */
function ListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field
      label={label}
      hint={hint || "Мөр бүр нэг мөр болж харагдана."}
      rows={Math.max(4, value.length + 1)}
      value={value.join("\n")}
      onChange={(v) => onChange(v.split("\n").map((s) => s.trim()).filter(Boolean))}
    />
  );
}

export default function AdminLandingPage() {
  const [content, setContent] = useState<Content | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/landing-content")
      .then((r) => r.json())
      .then((d) => setContent({ ...LANDING_DEFAULTS, ...(d?.content || {}) }))
      .catch(() => setContent({ ...LANDING_DEFAULTS }));
  }, []);

  const set = useCallback(<K extends keyof Content>(key: K, value: Content[K]) => {
    setContent((c) => (c ? { ...c, [key]: value } : c));
    setMsg("");
  }, []);

  const save = useCallback(async () => {
    if (!content) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/landing-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Хадгалагдсангүй");
      setContent({ ...LANDING_DEFAULTS, ...d.content });
      setMsg("Хадгаллаа — хуудас 60 секундэд шинэчлэгдэнэ.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Алдаа гарлаа");
    } finally {
      setSaving(false);
    }
  }, [content]);

  if (!content) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl pb-28">
      <SectionHeader
        title="Нүүр ба Курс"
        hint="Хоёр хуудасны бүх текст, зураг эндээс удирдагдана."
        action={
          <div className="flex gap-2">
            <Btn href="/" variant="ghost" size="sm">
              Нүүр харах
            </Btn>
            <Btn href="/classroom" variant="ghost" size="sm">
              Курс харах
            </Btn>
          </div>
        }
      />

      <div className="mb-6 inline-flex rounded-[4px] border p-1" style={{ borderColor: T.border }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-[4px] px-4 py-2 text-[12px] font-semibold transition ${
              tab === t.id ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8] hover:text-[#E8E8E8]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">Hero</div>
            <Field label="Eyebrow" value={content.homeEyebrow} onChange={(v) => set("homeEyebrow", v)} />
            <Field label="Гарчиг" value={content.homeTitle} onChange={(v) => set("homeTitle", v)} />
            <Field label="Тайлбар" rows={3} value={content.homeSub} onChange={(v) => set("homeSub", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Үндсэн товч" value={content.homeCtaLabel} onChange={(v) => set("homeCtaLabel", v)} />
              <Field label="Үндсэн товчны линк" value={content.homeCtaHref} onChange={(v) => set("homeCtaHref", v)} />
              <Field label="Хоёрдогч товч" value={content.homeCta2Label} onChange={(v) => set("homeCta2Label", v)} />
              <Field label="Хоёрдогч линк" value={content.homeCta2Href} onChange={(v) => set("homeCta2Href", v)} />
            </div>
            <Field
              label="Hero зураг (URL)"
              hint="Дугуй хүрээнд харагдана. Хоосон бол A монограм. Олон слайд хүсвэл /admin/hero ашигла — тэр нь давуу эрхтэй."
              value={content.homeImage}
              onChange={(v) => set("homeImage", v)}
            />
            <Field
              label="Элсэлт хаагдах огноо/цаг (УБ)"
              hint="Хоосон бол нүүр дэх тоолуур огт харагдахгүй. Хугацаа өнгөрмөгц өөрөө алга болно."
              type="datetime-local"
              value={content.enrollDeadline}
              onChange={(v) => set("enrollDeadline", v)}
            />
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E2E4E8]">
                Hero загвар
              </span>
              <select
                value={content.homeHeroLayout}
                onChange={(e) => set("homeHeroLayout", e.target.value)}
                className="w-full rounded-[4px] border bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#2E29FF]"
                style={{ borderColor: T.border }}
              >
                {HERO_LAYOUTS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label} — {l.hint}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-[#6B6B73]">
                Зөвхөн /admin/hero дээр слайд байхгүй үед хэрэглэгдэнэ.
              </span>
            </label>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
              [02] Хөтөлбөр
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Гарчиг" value={content.programHeading} onChange={(v) => set("programHeading", v)} />
              <Field label="Meta мөр" value={content.programMeta} onChange={(v) => set("programMeta", v)} />
            </div>
            <p className="text-[11px] leading-relaxed text-[#E2E4E8]">
              Өдрүүдийн нэр, тайлбар, минут, XP нь <code>lib/program.ts</code>-ээс ирнэ — хичээл ба
              mission-г «7 өдөр» табаас засна.
            </p>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
              [03] Community
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Гарчиг" value={content.communityHeading} onChange={(v) => set("communityHeading", v)} />
              <Field label="Meta мөр" value={content.communityMeta} onChange={(v) => set("communityMeta", v)} />
            </div>
            <div className="space-y-4">
              {content.features.map((f, i) => (
                <div key={i} className="rounded-[4px] border p-4" style={{ borderColor: T.border }}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#E2E4E8]">
                      Мөр {String(i + 1).padStart(2, "0")}
                    </span>
                    <button
                      onClick={() => set("features", content.features.filter((_, j) => j !== i))}
                      className="text-[11px] text-[#4C47FF] hover:underline"
                    >
                      Устгах
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Field
                      label="Нэр"
                      value={f.title}
                      onChange={(v) =>
                        set("features", content.features.map((x, j) => (j === i ? { ...x, title: v } : x)))
                      }
                    />
                    <Field
                      label="Тайлбар"
                      rows={2}
                      value={f.desc}
                      onChange={(v) =>
                        set("features", content.features.map((x, j) => (j === i ? { ...x, desc: v } : x)))
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field
                        label="Чип"
                        value={f.chip}
                        onChange={(v) =>
                          set("features", content.features.map((x, j) => (j === i ? { ...x, chip: v } : x)))
                        }
                      />
                      <label className="flex items-center gap-2 pb-2.5 text-[12px] text-[#E2E4E8]">
                        <input
                          type="checkbox"
                          checked={f.live}
                          onChange={(e) =>
                            set(
                              "features",
                              content.features.map((x, j) => (j === i ? { ...x, live: e.target.checked } : x))
                            )
                          }
                          className="accent-[#2E29FF]"
                        />
                        LIVE (улаан)
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              <Btn
                variant="ghost"
                size="sm"
                onClick={() =>
                  set("features", [...content.features, { title: "", desc: "", chip: "LIVE", live: true }])
                }
              >
                + Мөр нэмэх
              </Btn>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">[04] Plan</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Гарчиг" value={content.planHeading} onChange={(v) => set("planHeading", v)} />
              <Field label="Meta мөр" value={content.planMeta} onChange={(v) => set("planMeta", v)} />
            </div>
            <p className="text-[11px] leading-relaxed text-[#E2E4E8]">
              Үнэ ба багцын агуулга <code>lib/plans.ts</code>-ээс — төлбөртэй шууд холбоотой тул эндээс
              өөрчлөгдөхгүй.
            </p>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
              Эцсийн дуудлага
            </div>
            <Field label="Гарчиг" value={content.payoffTitle} onChange={(v) => set("payoffTitle", v)} />
            <Field label="Тайлбар" rows={2} value={content.payoffSub} onChange={(v) => set("payoffSub", v)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Товчны текст" value={content.payoffCtaLabel} onChange={(v) => set("payoffCtaLabel", v)} />
              <Field label="Товчны линк" value={content.payoffCtaHref} onChange={(v) => set("payoffCtaHref", v)} />
            </div>
          </Card>
        </div>
      )}

      {tab === "body" && (
        <div className="space-y-3">
          <Field
            label="Манифест (үүсгэн байгуулагчийн үг)"
            hint="Догол мөрийг ХООСОН МӨРӨӨР тусгаарла. **од хоёр** = тод үсэг. Хоосон бол хэсэг харагдахгүй."
            rows={12}
            value={content.homeManifesto}
            onChange={(v) => set("homeManifesto", v)}
          />
          <div className="h-px w-full bg-[#1E1E1E]" />
          <p className="text-[12px] leading-relaxed text-[#E2E4E8]">
            Hero-гийн дор харагдах хэсгүүд. Аль нь ч сонгогдоогүй бол зөвхөн hero
            харагдана. Жагсаалтын дараалал = хуудсан дээрх дараалал.
          </p>
          {HOME_SECTION_META.map((meta) => {
            const on = content.homeSections.includes(meta.key);
            const pos = content.homeSections.indexOf(meta.key);
            const move = (dir: number) => {
              const arr = [...content.homeSections];
              const i = arr.indexOf(meta.key);
              const j = i + dir;
              if (i < 0 || j < 0 || j >= arr.length) return;
              const tmp = arr[i];
              arr[i] = arr[j];
              arr[j] = tmp;
              set("homeSections", arr);
            };
            return (
              <div
                key={meta.key}
                className="flex items-center gap-3 rounded-[4px] border px-3 py-2.5"
                style={{ borderColor: T.border, background: on ? "#141416" : "transparent" }}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set(
                      "homeSections",
                      on
                        ? content.homeSections.filter((k) => k !== meta.key)
                        : [...content.homeSections, meta.key]
                    )
                  }
                  className={
                    on
                      ? "h-5 w-5 shrink-0 rounded-[4px] border border-[#2E29FF] bg-[#2E29FF] text-[11px] font-bold leading-none text-white"
                      : "h-5 w-5 shrink-0 rounded-[4px] border border-[#262626] text-[11px] font-bold leading-none text-transparent"
                  }
                >
                  Y
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-[#E8E8E8]">{meta.label}</span>
                  <span className="block text-[11px] text-[#6B6B73]">{meta.hint}</span>
                </span>
                {on && (
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="mr-1 text-[11px] tabular-nums text-[#6B6B73]">{pos + 1}</span>
                    <button
                      type="button"
                      aria-label="Deesh"
                      onClick={() => move(-1)}
                      className="h-7 w-7 rounded-[4px] border border-[#262626] text-[#E2E4E8] hover:text-[#E8E8E8]"
                    >
                      &uarr;
                    </button>
                    <button
                      type="button"
                      aria-label="Doosh"
                      onClick={() => move(1)}
                      className="h-7 w-7 rounded-[4px] border border-[#262626] text-[#E2E4E8] hover:text-[#E8E8E8]"
                    >
                      &darr;
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "course" && (
        <div className="space-y-5">
          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">Толгой</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Курсын код" value={content.courseCode} onChange={(v) => set("courseCode", v)} />
              <Field label="Түвшин" value={content.courseLevel} onChange={(v) => set("courseLevel", v)} />
            </div>
            <Field label="Гарчиг" value={content.courseTitle} onChange={(v) => set("courseTitle", v)} />
            <Field label="Тайлбар" rows={3} value={content.courseSub} onChange={(v) => set("courseSub", v)} />
            <ListField
              label="Элсэх картын жагсаалт"
              value={content.enrollBullets}
              onChange={(v) => set("enrollBullets", v)}
            />
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
              [01]–[02] Хөтөлбөр ба үр дүн
            </div>
            <Field
              label="Хөтөлбөрийн гарчиг"
              value={content.curriculumHeading}
              onChange={(v) => set("curriculumHeading", v)}
            />
            <ListField label="Төгсөхөд чи:" value={content.outcomes} onChange={(v) => set("outcomes", v)} />
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
              [03] Оператор
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Нэр" value={content.operatorName} onChange={(v) => set("operatorName", v)} />
              <Field
                label="Байршил"
                value={content.operatorLocation}
                onChange={(v) => set("operatorLocation", v)}
              />
            </div>
            <Field label="Танилцуулга" rows={4} value={content.operatorBio} onChange={(v) => set("operatorBio", v)} />
            <Field
              label="Зураг (URL)"
              hint="Дугуй хүрээнд. Хоосон бол A монограм."
              value={content.operatorPhoto}
              onChange={(v) => set("operatorPhoto", v)}
            />
          </Card>

          <Card className="space-y-4 p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">Доод хэсэг</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CTA гарчиг" value={content.courseCtaTitle} onChange={(v) => set("courseCtaTitle", v)} />
              <Field label="Координат" value={content.coords} onChange={(v) => set("coords", v)} />
            </div>
          </Card>
        </div>
      )}

      {tab === "days" && (
        <div className="space-y-4">
          <p className="text-[12px] leading-relaxed text-[#E2E4E8]">
            Өдрийн нэр, mission, хичээлүүд — курсын хуудасны accordion дотор харагдана. Минут ба XP нь
            <code className="mx-1">lib/program.ts</code>-ээс ирдэг тул эндээс өөрчлөгдөхгүй.
          </p>
          {PROGRAM_DAYS.map((def) => {
            const d =
              content.courseDays.find((x) => x.day === def.day) ||
              { day: def.day, title: def.title, mission: "", lessons: [] };
            const update = (patch: Partial<typeof d>) => {
              const rest = content.courseDays.filter((x) => x.day !== def.day);
              set(
                "courseDays",
                [...rest, { ...d, ...patch }].sort((a, b) => a.day - b.day)
              );
            };
            return (
              <Card key={def.day} className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#2E29FF]">
                    DAY {def.day}
                  </span>
                  <span className="text-[11px] text-[#E2E4E8]">
                    ~{def.durationMin} мин · +{def.xpReward} XP
                  </span>
                </div>
                <Field label="Нэр" value={d.title} onChange={(v) => update({ title: v })} />
                <Field label="Mission" rows={2} value={d.mission} onChange={(v) => update({ mission: v })} />
                <div className="space-y-2">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E2E4E8]">
                    Хичээлүүд
                  </span>
                  {d.lessons.map((l, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <input
                        value={l.t}
                        placeholder="Хичээлийн нэр"
                        onChange={(e) =>
                          update({ lessons: d.lessons.map((x, k) => (k === j ? { ...x, t: e.target.value } : x)) })
                        }
                        className="flex-1 rounded-[4px] border bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] outline-none focus:border-[#2E29FF]"
                        style={{ borderColor: T.border }}
                      />
                      <input
                        type="number"
                        value={l.m}
                        onChange={(e) =>
                          update({
                            lessons: d.lessons.map((x, k) =>
                              k === j ? { ...x, m: Number(e.target.value) || 0 } : x
                            ),
                          })
                        }
                        className="w-20 rounded-[4px] border bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] outline-none focus:border-[#2E29FF]"
                        style={{ borderColor: T.border }}
                      />
                      <button
                        onClick={() => update({ lessons: d.lessons.filter((_, k) => k !== j) })}
                        className="px-2 text-[13px] text-[#4C47FF] hover:underline"
                        aria-label="Устгах"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => update({ lessons: [...d.lessons, { t: "", m: 10 }] })}
                  >
                    + Хичээл нэмэх
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Наалдсан хадгалах зурвас — урт формоос дээш гүйлгэх шаардлагагүй. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 border-t bg-[#0A0A0A]/95 px-4 py-3 backdrop-blur"
        style={{ borderColor: T.border }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <span className="text-[12px] text-[#E2E4E8]">{msg}</span>
          <div className="flex items-center gap-2">
            <Link href="/admin/hero" className="text-[12px] text-[#E2E4E8] hover:text-[#E8E8E8]">
              Hero слайд →
            </Link>
            <Btn onClick={save} loading={saving} disabled={saving}>
              Хадгалах
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
