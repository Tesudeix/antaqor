"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { PLANS, formatMNT, annualPrice } from "@/lib/plans";
import { getLevelTitle, getLevelProgress, xpForLevel } from "@/lib/xpClient";

// ─── 7 хоногийн аяллын самбар — нэвтэрсэн нүүрний гол хэсэг ───
// Бүх unlock-төлөв серверээс ирнэ; энд зөвхөн харуулна. Countdown серверийн
// цагийн offset-оор тоолж, 0 болмогц journey-г дахин татна (refresh хэрэггүй).

type DayStatus = "available" | "in_progress" | "completed" | "locked" | "preordered" | "coming_soon";
type AssignmentStatus = "not_started" | "draft" | "submitted" | "needs_revision" | "approved";

interface Assignment {
  objective: string;
  instructions: string[];
  deliverable: string;
  checklist: string[];
  example: string;
}

interface JourneyDay {
  day: number;
  title: string;
  description: string;
  durationMin: number;
  xpReward: number;
  releaseAt: string;
  status: DayStatus;
  lessonDone: boolean;
  assignmentStatus: AssignmentStatus;
  draftText: string;
  submittedText: string;
  submittedUrl: string;
  feedback: string;
  assignment: Assignment;
}

interface Journey {
  serverNow: string;
  isPaid: boolean;
  firstName: string;
  totals: { completedDays: number; lessonsDone: number; assignmentsDone: number; xp: number; level?: number; streakDays: number; subDaysLeft?: number | null };
  currentDay: number | null;
  nextUnlockAt: string | null;
  days: JourneyDay[];
}

const STATUS_META: Record<DayStatus, { icon: string; label: string; cls: string }> = {
  available: { icon: "▶", label: "Нээлттэй", cls: "bg-[#2E29FF] text-white" },
  in_progress: { icon: "◐", label: "Үргэлжилж байна", cls: "bg-[#2E29FF] text-white" },
  completed: { icon: "✓", label: "Дууссан", cls: "border border-[#4ADE80]/60 text-[#4ADE80]" },
  locked: { icon: "🔒", label: "Түгжээтэй", cls: "bg-[#1E1E1E] text-[#E2E4E8]" },
  preordered: { icon: "✓", label: "Захиалсан", cls: "border border-[#2E29FF]/60 text-[#2E29FF]" },
  coming_soon: { icon: "◷", label: "Тун удахгүй", cls: "bg-[#1E1E1E] text-[#E2E4E8]" },
};

const ASSIGN_META: Record<AssignmentStatus, { label: string; color: string }> = {
  not_started: { label: "Даалгавар: эхлээгүй", color: "var(--t-body, #30333F)" },
  draft: { label: "Даалгавар: ноорог", color: "#F59E0B" },
  submitted: { label: "Даалгавар: илгээсэн — шалгагдаж байна", color: "var(--accent-ink, #2E29FF)" },
  needs_revision: { label: "Даалгавар: засвар хэрэгтэй", color: "var(--accent-ink-2, #1F1AD9)" },
  approved: { label: "Даалгавар: батлагдсан ✓", color: "#4ADE80" },
};

function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, "0");
}

// Серверийн цагийн offset-той countdown — локал цаг өөрчилсөн ч нөлөөгүй.
function useServerCountdown(targetIso: string | null, offsetMs: number, onZero: () => void) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!targetIso) {
      setLeft(null);
      return;
    }
    const target = new Date(targetIso).getTime();
    const tick = () => {
      const now = Date.now() + offsetMs;
      const ms = target - now;
      if (ms <= 0) {
        setLeft({ d: 0, h: 0, m: 0, s: 0 });
        if (!firedRef.current) {
          firedRef.current = true;
          onZero();
        }
        return;
      }
      setLeft({
        d: Math.floor(ms / 86400000),
        h: Math.floor((ms % 86400000) / 3600000),
        m: Math.floor((ms % 3600000) / 60000),
        s: Math.floor((ms % 60000) / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [targetIso, offsetMs, onZero]);

  return left;
}

function fmtLocal(iso: string): string {
  return new Date(iso).toLocaleString("mn-MN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2E29FF] focus-visible:outline-offset-2";

export default function JourneyBoard() {
  const [j, setJ] = useState<Journey | null>(null);
  const [err, setErr] = useState("");
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const offsetRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me/journey");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Journey;
      offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
      setJ(data);
      setErr("");
    } catch {
      setErr("Хөтөлбөр ачаалж чадсангүй — дахин оролдоно уу.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onZero = useCallback(() => {
    // Countdown 0 боллоо — сервер шинэ төлвийг өгнө (хуудас refresh хэрэггүй).
    setTimeout(load, 1200);
  }, [load]);

  const countdown = useServerCountdown(j?.nextUnlockAt ?? null, offsetRef.current, onZero);

  const act = async (action: string, day: number, extra?: { text?: string; url?: string }) => {
    setBusy(action);
    setNote("");
    try {
      const res = await fetch("/api/users/me/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, day, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(
          data.error === "locked"
            ? "Энэ өдөр хараахан нээгдээгүй байна."
            : data.error === "submission_empty"
              ? "Текст (10+ тэмдэгт) эсвэл линк оруулна уу."
              : "Алдаа гарлаа — дахин оролдоно уу."
        );
        return;
      }
      offsetRef.current = new Date(data.serverNow).getTime() - Date.now();
      setJ(data as Journey);
      if (action === "submit") {
        setNote("✓ Ажил илгээгдлээ! XP нэмэгдлээ.");
        track("mission_submitted", { day });
      }
      if (action === "save_draft") setNote("✓ Ноорог хадгалагдлаа.");
      if (action === "lesson_done") setNote("✓ Хичээл тэмдэглэгдлээ. Одоо даалгавраа хий!");
    } catch {
      setNote("Сүлжээний алдаа.");
    } finally {
      setBusy(null);
    }
  };

  const open = (d: JourneyDay) => {
    setOpenDay(d.day);
    setDraft(d.draftText || d.submittedText || "");
    setUrl(d.submittedUrl || "");
    setNote("");
  };

  // ── Loading / error states ──
  if (err) {
    return (
      <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-6 text-center">
        <p className="text-[13px] text-[#E2E4E8]">{err}</p>
        <button onClick={load} className={`mt-4 h-11 rounded-[4px] bg-[#2E29FF] px-6 text-[12px] font-bold text-white ${FOCUS}`}>
          Дахин ачаалах
        </button>
      </div>
    );
  }
  if (!j) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Ачаалж байна">
        <div className="h-40 animate-pulse rounded-[4px] bg-[#0A0A0A]" />
        <div className="h-56 animate-pulse rounded-[4px] bg-[#0A0A0A]" />
      </div>
    );
  }

  const current = j.currentDay ? j.days.find((d) => d.day === j.currentDay) : null;
  const nextLocked = j.days.find((d) => d.status === "preordered" || (d.status === "locked" && j.isPaid));
  const modal = openDay ? j.days.find((d) => d.day === openDay) : null;
  const runner = PLANS.starter;

  return (
    <div className="space-y-5">
      {/* ── [01] ОДОО ХИЙХ — Continue Learning dominant card ── */}
      <section aria-label="Одоо хийх зүйл" className="relative rounded-[4px] border border-[#2E29FF] bg-[#0A0A0A] p-5 sm:p-6">
        {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c, i) => (
          <span key={i} className={`pointer-events-none absolute h-3 w-3 border-[#2E29FF] ${c}`} />
        ))}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="chrome mb-2 flex items-center gap-2 text-[11px] font-bold">
              <span className="text-[#2E29FF]">01</span>
              <span className="text-[#E2E4E8]">ОДОО ХИЙХ ЗҮЙЛ</span>
            </div>
            {!j.isPaid ? (
              <>
                <h2 className="text-[18px] font-bold text-[#FFFFFF]">Эрхээ идэвхжүүлээд Day 1-ээ эхлүүл</h2>
                <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[#E2E4E8]">
                  7 хоногийн хөтөлбөр, даалгавар, community — бүгд нэг гишүүнчлэлд.
                  Төлбөр төлөгдмөгц эрх чинь автоматаар идэвхжиж, Day 1 шууд нээгдэнэ. Жилээр авбал −20%.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/pricing?plan=starter"
                    onClick={() => track("pricing_viewed", { source: "journey_activate" })}
                    className={`inline-flex h-12 items-center rounded-[4px] bg-[#2E29FF] px-7 text-[13px] font-bold uppercase text-white transition hover:bg-[#1F1AD9] ${FOCUS}`}
                  >
                    Урьдчилан захиалах — {formatMNT(runner.price)}/сар
                  </Link>
                  <Link
                    href="/pricing?plan=starter&period=year"
                    className={`inline-flex h-12 items-center rounded-[4px] border border-[#2E29FF] px-5 text-[12px] font-bold uppercase text-[#2E29FF] transition hover:bg-[#2E29FF] hover:text-white ${FOCUS}`}
                  >
                    Жилээр −20% · {formatMNT(annualPrice(runner))}
                  </Link>
                </div>
              </>
            ) : current ? (
              <>
                <h2 className="text-[18px] font-bold text-[#FFFFFF]">
                  DAY {current.day} — {current.title}
                </h2>
                <p className="mt-1 text-[13px] text-[#E2E4E8]">{current.description}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="chrome text-[11px] font-bold text-[#E2E4E8]">~{current.durationMin} МИН</span>
                  <span className="chrome text-[11px] font-bold text-[#E2E4E8]">+{current.xpReward} XP</span>
                  <span className="text-[11px] font-bold" style={{ color: ASSIGN_META[current.assignmentStatus].color }}>
                    {current.lessonDone ? "Хичээл ✓ · " : ""}{ASSIGN_META[current.assignmentStatus].label}
                  </span>
                </div>
                <button
                  onClick={() => open(current)}
                  className={`mt-4 inline-flex h-12 items-center rounded-[4px] bg-[#2E29FF] px-7 text-[13px] font-bold uppercase text-white transition hover:bg-[#1F1AD9] active:translate-y-[1px] ${FOCUS}`}
                >
                  {current.status === "available" ? "Хичээлээ эхлүүлэх" : current.lessonDone ? "Даалгавар хийх" : "Үргэлжлүүлэн суралцах"} →
                </button>
              </>
            ) : j.totals.completedDays >= 7 ? (
              <>
                <h2 className="text-[18px] font-bold text-[#2E29FF]">🎉 7 хоногийн хөтөлбөрөө дуусгалаа!</h2>
                <p className="mt-1.5 max-w-md text-[13px] text-[#E2E4E8]">
                  Ship хийсэн зүйлээ Feed-д хуваалцаад, mission-уудаар үргэлжлүүл.
                </p>
                <Link href="/feed" className={`mt-4 inline-flex h-12 items-center rounded-[4px] bg-[#2E29FF] px-7 text-[13px] font-bold uppercase text-white hover:bg-[#1F1AD9] ${FOCUS}`}>
                  Feed-д хуваалцах →
                </Link>
              </>
            ) : (
              <>
                <h2 className="text-[18px] font-bold text-[#FFFFFF]">Өнөөдрийнхөө дууссан — сайн байна 🔥</h2>
                <p className="mt-1.5 text-[13px] text-[#E2E4E8]">Дараагийн хичээл автоматаар нээгдэнэ. Хүлээх зуураа Feed-ээ шалгаарай.</p>
              </>
            )}
          </div>

          {/* Дараагийн хичээлийн countdown — Д:Ц:М:С */}
          {j.nextUnlockAt && countdown && (
            <div className="w-full shrink-0 rounded-[4px] bg-[#0A0A0A] p-4 sm:w-auto" role="timer" aria-label="Дараагийн хичээл нээгдэх хугацаа">
              <div className="chrome text-[11px] font-bold text-[#E2E4E8]">ДАРААГИЙН ХИЧЭЭЛ НЭЭГДЭХЭД</div>
              <div className="mt-2 flex items-end gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {([["Ө", countdown.d], ["Ц", countdown.h], ["М", countdown.m], ["С", countdown.s]] as [string, number][]).map(([u, v]) => (
                  <div key={u} className="text-center">
                    <div className="min-w-[44px] rounded-[4px] bg-[#141414] px-2 py-1.5 text-[22px] font-bold leading-none text-[#2E29FF]" style={{ fontFamily: "var(--font-display)" }}>
                      {pad(v)}
                    </div>
                    <div className="chrome mt-1 text-[7px] font-bold text-[#E2E4E8]">{u}</div>
                  </div>
                ))}
              </div>
              {nextLocked && (
                <div className="chrome mt-2 text-[8px] text-[#E2E4E8]">
                  DAY {nextLocked.day} · {fmtLocal(nextLocked.releaseAt)}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── [02] 7 хоногийн зам ── */}
      <section aria-label="7 хоногийн хөтөлбөр">
        <div className="chrome mb-3 flex items-center gap-2 text-[11px] font-bold">
          <span className="text-[#2E29FF]">02</span>
          <span className="text-[#E2E4E8]">7 ХОНОГИЙН ХӨТӨЛБӨР · ШИНЭ · ЭРЧИМЖҮҮЛСЭН</span>
          <span className="hidden h-px flex-1 bg-[#262626] md:block" />
          <span className="shrink-0 text-[#2E29FF]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {j.totals.completedDays}/7
          </span>
        </div>
        {/* Нийт явцын зурвас */}
        <div className="mb-4 h-1.5 rounded-[4px] bg-[#262626]" role="progressbar" aria-valuemin={0} aria-valuemax={7} aria-valuenow={j.totals.completedDays} aria-label="7 хоногийн явц">
          <div className="h-full rounded-[4px] bg-[#2E29FF] transition-all" style={{ width: `${Math.round((j.totals.completedDays / 7) * 100)}%` }} />
        </div>

        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 xl:grid-cols-7">
          {j.days.map((d) => {
            const meta = STATUS_META[d.status];
            const active = d.status === "available" || d.status === "in_progress";
            return (
              <button
                key={d.day}
                onClick={() => open(d)}
                aria-label={`DAY ${d.day}: ${d.title} — ${meta.label}`}
                className={`flex w-[220px] shrink-0 snap-start flex-col rounded-[4px] border p-4 text-left transition lg:w-auto ${FOCUS} ${
                  active
                    ? "border-[#2E29FF] bg-[#0A0A0A] hover:-translate-y-0.5"
                    : d.status === "completed"
                      ? "border-[#262626] bg-[#0A0A0A]"
                      : "border-[#262626] bg-[#141414] opacity-80 hover:opacity-100"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="chrome text-[11px] font-bold text-[#E2E4E8]">ӨДӨР {d.day}</span>
                  <span className={`chrome rounded-[4px] px-1.5 py-1 text-[7px] font-bold ${meta.cls}`}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <div className={`text-[14px] font-bold leading-snug ${d.status === "locked" && j.isPaid ? "text-[#E2E4E8]" : "text-[#FFFFFF]"}`}>
                  {d.title}
                </div>
                <p className="mt-1 line-clamp-2 flex-1 text-[11px] leading-snug text-[#E2E4E8]">{d.description}</p>
                <div className="chrome mt-3 flex items-center justify-between border-t border-[#262626] pt-2 text-[8px] font-bold text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span>~{d.durationMin}М · +{d.xpReward}XP</span>
                  {d.status === "preordered" || d.status === "locked" ? (
                    <span>{fmtLocal(d.releaseAt)}</span>
                  ) : d.lessonDone ? (
                    <span className="text-[#4ADE80]">ХИЧЭЭЛ ✓</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── [03] Явц ба урам ── */}
      <section aria-label="Миний явц">
        <div className="chrome mb-3 flex items-center gap-2 text-[11px] font-bold">
          <span className="text-[#2E29FF]">03</span>
          <span className="text-[#E2E4E8]">МИНИЙ ЯВЦ</span>
          <span className="hidden h-px flex-1 bg-[#262626] md:block" />
        </div>
        {/* Level XP + streak — тоглоомын мэдрэмж, бодит тоон дээр */}
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="chrome text-[8px] font-bold text-[#E2E4E8]">
                LVL {j.totals.level || 1} · {getLevelTitle(j.totals.level || 1).titleMN}
              </span>
              <span className="chrome text-[11px] font-bold text-[#2E29FF]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {j.totals.xp.toLocaleString()} / {xpForLevel((j.totals.level || 1) + 1).toLocaleString()} XP
              </span>
            </div>
            <div className="h-1.5 rounded-[4px] bg-[#262626]" role="progressbar" aria-label="Level явц">
              <div
                className="h-full rounded-[4px] bg-[#2E29FF] transition-all"
                style={{ width: `${Math.round(getLevelProgress(j.totals.xp, j.totals.level || 1) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="chrome text-[8px] font-bold text-[#E2E4E8]">STREAK — ДАРААЛСАН ӨДӨР</span>
              <span className="chrome text-[11px] font-bold text-[#F59E0B]" style={{ fontVariantNumeric: "tabular-nums" }}>
                {j.totals.streakDays} 🔥
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => {
                const active = i >= 7 - Math.min(j.totals.streakDays, 7);
                return (
                  <span
                    key={i}
                    className={`h-3 flex-1 rounded-[4px] ${active ? "bg-[#F59E0B]" : "bg-[#262626]"}`}
                    aria-hidden
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] bg-[#262626] sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "ДУУССАН ӨДӨР", value: `${j.totals.completedDays}/7` },
          { label: "ХИЧЭЭЛ", value: String(j.totals.lessonsDone) },
          { label: "ДААЛГАВАР", value: String(j.totals.assignmentsDone) },
          { label: "НИЙТ XP", value: String(j.totals.xp) },
          { label: "STREAK", value: `${j.totals.streakDays}🔥` },
          { label: "ЭРХ ҮЛДСЭН", value: j.totals.subDaysLeft != null ? `${j.totals.subDaysLeft} хоног` : "—" },
        ].map((c) => (
          <div key={c.label} className="bg-[#0A0A0A] px-3 py-4 text-center">
            <div className="text-[18px] font-bold text-[#2E29FF]" style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>
              {c.value}
            </div>
            <div className="chrome mt-1 text-[7px] font-bold text-[#E2E4E8]">{c.label}</div>
          </div>
        ))}
        </div>
      </section>
      {j.isPaid && j.totals.completedDays < 7 && (
        <p className="chrome text-[8px] text-[#E2E4E8]">
          ДАРААГИЙН ЗОРИЛТ: {j.totals.completedDays < 4 ? "DAY 4 — ПРАКТИК ДУУСГАХ" : "DAY 7 — ТӨСЛӨӨ SHIP ХИЙХ"}
        </p>
      )}

      {/* ── Өдрийн дэлгэрэнгүй modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`DAY ${modal.day} — ${modal.title}`}
          onClick={() => setOpenDay(null)}
          onKeyDown={(e) => e.key === "Escape" && setOpenDay(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[4px] bg-[#141414] bg-[#0A0A0A] p-5 sm:rounded-[4px] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="chrome flex items-center gap-2 text-[11px] font-bold">
                  <span className="text-[#2E29FF]">ӨДӨР {modal.day}</span>
                  <span className={`chrome rounded-[4px] px-1.5 py-1 text-[7px] font-bold ${STATUS_META[modal.status].cls}`}>
                    {STATUS_META[modal.status].icon} {STATUS_META[modal.status].label}
                  </span>
                </div>
                <h3 className="mt-1.5 text-[20px] font-bold text-[#FFFFFF]">{modal.title}</h3>
                <p className="mt-0.5 text-[13px] text-[#E2E4E8]">{modal.description}</p>
                <div className="chrome mt-2 text-[8px] font-bold text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  ~{modal.durationMin} МИН · +{modal.xpReward} XP · НЭЭГДЭХ: {fmtLocal(modal.releaseAt)}
                </div>
              </div>
              <button onClick={() => setOpenDay(null)} aria-label="Хаах" className={`chrome shrink-0 rounded-[4px] bg-[#1E1E1E] px-2.5 py-2 text-[11px] font-bold text-[#E2E4E8] hover:border-[#2E29FF] hover:text-[#2E29FF] ${FOCUS}`}>
                ✕
              </button>
            </div>

            {/* Түгжээтэй / захиалсан өдөр */}
            {(modal.status === "locked" || modal.status === "preordered" || modal.status === "coming_soon") && (
              <div className="space-y-4">
                <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-4">
                  <div className="chrome mb-2 text-[11px] font-bold text-[#E2E4E8]">НЭЭГДЭХ НӨХЦӨЛ</div>
                  <ul className="space-y-1.5 text-[13px] text-[#F2F2F4]">
                    <li className="flex gap-2">
                      Нээгдэх цаг: {fmtLocal(modal.releaseAt)} (таны цагаар)
                    </li>
                    {modal.day > 1 && (
                      <li className="flex gap-2">
                        DAY {modal.day - 1}-ийн хичээл + даалгаврыг эхлээд дуусгана
                      </li>
                    )}
                  </ul>
                </div>
                {!j.isPaid ? (
                  <div className="rounded-[4px] border border-[#2E29FF] p-4">
                    <div className="chrome mb-1 text-[11px] font-bold text-[#2E29FF]">УРЬДЧИЛАН ЗАХИАЛГА</div>
                    <p className="mb-3 text-[13px] text-[#F2F2F4]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      Бүтэн хөтөлбөр: сард {formatMNT(runner.price)} · жилээр {formatMNT(annualPrice(runner))} (−20%).
                      Нээгдэхэд дахин төлөхгүй.
                    </p>
                    <Link
                      href="/pricing?plan=starter"
                      className={`inline-flex h-11 items-center rounded-[4px] bg-[#2E29FF] px-6 text-[12px] font-bold uppercase text-white hover:bg-[#1F1AD9] ${FOCUS}`}
                    >
                      Урьдчилан захиалах →
                    </Link>
                  </div>
                ) : (
                  modal.status === "preordered" && (
                    <p className="text-[12px] text-[#E2E4E8]">
                      ✓ Төлбөр хийгдсэн — хуваарийн дагуу автоматаар нээгдэнэ. Дахин төлөх шаардлагагүй.
                    </p>
                  )
                )}
              </div>
            )}

            {/* Нээлттэй өдөр — хичээл + даалгавар */}
            {(modal.status === "available" || modal.status === "in_progress" || modal.status === "completed") && (
              <div className="space-y-4">
                {/* Хичээл */}
                <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="chrome text-[11px] font-bold text-[#E2E4E8]">1 · ХИЧЭЭЛ</span>
                    {modal.lessonDone && <span className="text-[11px] font-bold text-[#4ADE80]">✓ Үзсэн</span>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/classroom"
                      onClick={() => track("lesson_started", { day: modal.day })}
                      className={`inline-flex h-11 items-center rounded-[4px] bg-[#2E29FF] px-5 text-[12px] font-bold uppercase text-white hover:bg-[#1F1AD9] ${FOCUS}`}
                    >
                      {modal.lessonDone ? "Дахин үзэх" : "Хичээлээ эхлүүлэх"} →
                    </Link>
                    {!modal.lessonDone && (
                      <button
                        onClick={() => act("lesson_done", modal.day)}
                        disabled={busy !== null}
                        className={`inline-flex h-11 items-center rounded-[4px] bg-[#1E1E1E] px-5 text-[12px] font-bold text-[#FFFFFF] transition hover:border-[#4ADE80] hover:text-[#4ADE80] disabled:opacity-50 ${FOCUS}`}
                      >
                        {busy === "lesson_done" ? "..." : "Хичээлээ дуусгасан ✓"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Даалгавар */}
                <div className="rounded-[4px] bg-[#141414] bg-[#0A0A0A] p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="chrome text-[11px] font-bold text-[#E2E4E8]">2 · ПРАКТИК ДААЛГАВАР</span>
                    <span className="text-[10px] font-bold" style={{ color: ASSIGN_META[modal.assignmentStatus].color }}>
                      {ASSIGN_META[modal.assignmentStatus].label}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-[13px] leading-relaxed text-[#F2F2F4]">
                    <p><span className="chrome text-[8px] font-bold text-[#2E29FF]">ЗОРИЛГО · </span>{modal.assignment.objective}</p>
                    <div>
                      <span className="chrome text-[8px] font-bold text-[#2E29FF]">ЗААВАР</span>
                      <ol className="mt-1 space-y-1">
                        {modal.assignment.instructions.map((s, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px]">
                            <span className="chrome shrink-0 text-[11px] font-bold text-[#E2E4E8]">{i + 1}.</span>
                            {s}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <p><span className="chrome text-[8px] font-bold text-[#2E29FF]">ИЛГЭЭХ ЗҮЙЛ · </span>{modal.assignment.deliverable}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {modal.assignment.checklist.map((c) => (
                        <span key={c} className="chrome rounded-[4px] bg-[#141414] px-2 py-1 text-[8px] text-[#E2E4E8]">☐ {c}</span>
                      ))}
                    </div>
                    <p className="border-l-2 border-[#262626] pl-3 text-[12px] italic text-[#E2E4E8]">Жишээ: {modal.assignment.example}</p>
                  </div>

                  {modal.feedback && (
                    <div className="mt-3 rounded-[4px] border border-[#1F1AD9]/40 bg-[#1F1AD9]/5 p-3 text-[12px] text-[#FFFFFF]">
                      <span className="chrome text-[8px] font-bold text-[#4C47FF]">FEEDBACK · </span>{modal.feedback}
                    </div>
                  )}

                  {modal.assignmentStatus !== "approved" && (
                    <div className="mt-4 space-y-2.5">
                      <label className="chrome block text-[8px] font-bold text-[#E2E4E8]" htmlFor={`sub-${modal.day}`}>
                        АЖЛАА ЭНД БИЧ / ЛИНКЭЭ ОРУУЛ
                      </label>
                      <textarea
                        id={`sub-${modal.day}`}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={4}
                        maxLength={5000}
                        placeholder="Юу хийснээ, юу сурснаа энд бич…"
                        className={`w-full rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FFFFFF] outline-none transition focus:border-[#2E29FF] ${FOCUS}`}
                      />
                      <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        maxLength={600}
                        placeholder="Линк (сонголтоор): скриншот, файл, пост…"
                        aria-label="Ажлын линк"
                        className={`w-full rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FFFFFF] outline-none transition focus:border-[#2E29FF] ${FOCUS}`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => act("submit", modal.day, { text: draft, url })}
                          disabled={busy !== null}
                          className={`inline-flex h-11 items-center rounded-[4px] bg-[#2E29FF] px-6 text-[12px] font-bold uppercase text-white transition hover:bg-[#1F1AD9] disabled:opacity-50 ${FOCUS}`}
                        >
                          {busy === "submit" ? "Илгээж байна…" : modal.assignmentStatus === "submitted" ? "Дахин илгээх" : "Ажлаа илгээх"}
                        </button>
                        <button
                          onClick={() => act("save_draft", modal.day, { text: draft })}
                          disabled={busy !== null || modal.assignmentStatus === "submitted"}
                          className={`inline-flex h-11 items-center rounded-[4px] bg-[#1E1E1E] px-5 text-[12px] font-bold text-[#E2E4E8] transition hover:border-[#2E29FF] hover:text-[#2E29FF] disabled:opacity-40 ${FOCUS}`}
                        >
                          {busy === "save_draft" ? "..." : "Ноорог хадгалах"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {note && (
                  <p className="text-[13px] font-medium" style={{ color: note.startsWith("✓") ? "#4ADE80" : "#1F1AD9" }} role="status">
                    {note}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
