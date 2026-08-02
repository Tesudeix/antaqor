"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track, trackOnce } from "@/lib/analytics";

// ─── Onboarding — 3 steps max, then straight into the first lesson ───
// Step 1: goal · Step 2: experience · Step 3: start the recommended lesson.
// No industry, revenue, job title, or long forms.

const GOALS = [
  { id: "learn", label: "AI сурмаар байна", desc: "Суурьнаас нь системтэй эхлэх" },
  { id: "build", label: "Төсөл бүтээмээр байна", desc: "Мэдлэгээ бодит output болгох" },
  { id: "automate", label: "Бизнесээ автоматжуулмаар байна", desc: "Ажлын урсгалаа AI-д даалгах" },
];

const LEVELS = [
  { id: "beginner", label: "Анхан", desc: "AI tool бараг хэрэглэж үзээгүй" },
  { id: "intermediate", label: "Дунд", desc: "ChatGPT зэргийг тогтмол хэрэглэдэг" },
  { id: "advanced", label: "Ахисан", desc: "Автоматжуулалт, код бичиж үзсэн" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    trackOnce("onboarding_view");
    // Prefetch the recommended (free starter) course for step 3.
    fetch("/api/users/me/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d?.course?._id) setCourseId(d.course._id);
        if (d?.nextLesson?.title) setLessonTitle(d.nextLesson.title);
      })
      .catch(() => {});
  }, []);

  const pick = (kind: "goal" | "level", value: string) => {
    if (kind === "goal") {
      setGoal(value);
      setStep(2);
    } else {
      setExperience(value);
      setStep(3);
      // Persist in the background — step 3 doesn't wait on the network.
      setSaving(true);
      fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, experience: value }),
      })
        .then(() => trackOnce("onboarding_completed"))
        .finally(() => setSaving(false));
    }
  };

  return (
    <main className="mx-auto flex min-h-[85vh] w-full max-w-md flex-col justify-center px-4 py-10">
      {/* progress */}
      <div className="mb-8 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1 flex-1 ${n <= step ? "bg-[#1080CA]" : "bg-[#2E2E33]"}`} />
        ))}
      </div>

      {step === 1 && (
        <>
          <div className="chrome mb-2 text-[10px] text-[#1080CA]">АЛХАМ 1/3</div>
          <h1 className="headline mb-6 text-[24px]">Одоо ямар зорилготой байна?</h1>
          <div className="space-y-3">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => pick("goal", g.id)}
                className="w-full border border-[#2E2E33] bg-[#1E1E21] p-5 text-left transition hover:border-[#1080CA]"
              >
                <div className="mb-1 text-[15px] font-bold text-[#F2F2F4]">{g.label}</div>
                <div className="text-[12px] text-[#B4B4BA]">{g.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="chrome mb-2 text-[10px] text-[#1080CA]">АЛХАМ 2/3</div>
          <h1 className="headline mb-6 text-[24px]">AI туршлага чинь ямар вэ?</h1>
          <div className="space-y-3">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => pick("level", l.id)}
                className="w-full border border-[#2E2E33] bg-[#1E1E21] p-5 text-left transition hover:border-[#1080CA]"
              >
                <div className="mb-1 text-[15px] font-bold text-[#F2F2F4]">{l.label}</div>
                <div className="text-[12px] text-[#B4B4BA]">{l.desc}</div>
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="chrome mt-6 text-left text-[10px] text-[#84848C] hover:text-[#F2F2F4]">
            ← БУЦАХ
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <div className="chrome mb-2 text-[10px] text-[#1080CA]">АЛХАМ 3/3</div>
          <h1 className="headline mb-3 text-[24px]">Бэлэн. Эхний хичээл чинь энэ.</h1>
          <div className="mb-6 border border-[#1080CA]/40 bg-[#1E1E21] p-5">
            <div className="chrome mb-2 text-[9px] text-[#1080CA]">ОДОО ХИЙХ ЗҮЙЛ</div>
            <div className="mb-1 text-[16px] font-bold text-[#F2F2F4]">
              {lessonTitle ? `AI суурь — ${lessonTitle}` : "AI суурь — Хичээл 1"}
            </div>
            <div className="text-[12px] text-[#B4B4BA]">Ойролцоогоор 8 минут · Free</div>
          </div>
          <button
            onClick={() => {
              track("first_lesson_started", { source: "onboarding" });
              router.push(courseId ? `/classroom/course/${courseId}` : "/");
            }}
            disabled={saving}
            className="w-full bg-[#1080CA] py-4 text-[14px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8] disabled:opacity-60"
          >
            Lesson эхлүүлэх →
          </button>
          <button
            onClick={() => router.push("/")}
            className="mt-3 w-full py-2 text-[12px] text-[#84848C] transition hover:text-[#F2F2F4]"
          >
            Дараа — dashboard руу
          </button>
        </>
      )}
    </main>
  );
}
