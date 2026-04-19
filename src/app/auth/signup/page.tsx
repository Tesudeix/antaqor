"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface QuizAnswer {
  q1: string; // prompt engineering experience
  q2: string; // AI tools used
  q3: string; // goal
}

function calculateLevel(answers: QuizAnswer): { level: string; label: string; description: string } {
  let score = 0;

  // Q1: Prompt engineering experience
  if (answers.q1 === "none") score += 0;
  else if (answers.q1 === "basic") score += 1;
  else if (answers.q1 === "intermediate") score += 2;
  else if (answers.q1 === "advanced") score += 3;

  // Q2: AI tools used
  if (answers.q2 === "none") score += 0;
  else if (answers.q2 === "chatgpt") score += 1;
  else if (answers.q2 === "multiple") score += 2;
  else if (answers.q2 === "api") score += 3;

  // Q3: Goal
  if (answers.q3 === "learn") score += 0;
  else if (answers.q3 === "use") score += 1;
  else if (answers.q3 === "build") score += 2;
  else if (answers.q3 === "business") score += 3;

  if (score <= 2) {
    return { level: "beginner", label: "Beginner", description: "AI-н үндсэн ойлголтуудаас эхлэх сургалт танд тохирно" };
  } else if (score <= 5) {
    return { level: "intermediate", label: "Intermediate", description: "Промпт инженеринг, автоматжуулалтын сургалт танд тохирно" };
  } else {
    return { level: "advanced", label: "Advanced", description: "AI бизнес, API интеграци, дэвшилтэт сургалт танд тохирно" };
  }
}

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState<"quiz" | "result" | "register">("quiz");
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer>({ q1: "", q2: "", q3: "" });
  const [aiLevel, setAiLevel] = useState<{ level: string; label: string; description: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const quizComplete = quizAnswers.q1 && quizAnswers.q2 && quizAnswers.q3;

  const handleQuizSubmit = () => {
    const result = calculateLevel(quizAnswers);
    setAiLevel(result);
    setStep("result");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !phone || !email || !password || password.length < 6) {
      setError("Бүх талбарыг бөглөнө үү (нууц үг 6+ тэмдэгт)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password, aiLevel: aiLevel?.level }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const signInRes = await signIn("credentials", {
        login: email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError(signInRes.error);
      } else {
        router.push("/clan");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const optionClass = (selected: boolean) =>
    `w-full rounded-[4px] border px-4 py-3 text-left text-[13px] transition ${
      selected
        ? "border-[#EF2C58] bg-[rgba(239,44,88,0.06)] text-[#1A1A1A] font-semibold"
        : "border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] text-[#666666] hover:border-[rgba(0,0,0,0.15)]"
    }`;

  // ─── Quiz Step ───
  if (step === "quiz") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-[440px]">
          <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-8">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#EF2C58]">
              AI боловсролын түвшин
            </div>
            <h1 className="mb-2 text-[22px] font-bold text-[#1A1A1A]">
              Бүртгүүлэхийн өмнө
            </h1>
            <p className="mb-6 text-[12px] text-[#888888]">
              Танд тохирох сургалтын түвшинг тодорхойлъё
            </p>

            <div className="space-y-6">
              {/* Q1: Prompt Engineering */}
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]">
                  1. Промпт инженеринг (Prompt Engineering) туршлага
                </label>
                <div className="space-y-2">
                  {[
                    { value: "none", label: "Мэдэхгүй / Анх удаа сонсож байна" },
                    { value: "basic", label: "ChatGPT-д энгийн асуулт бичих чаддаг" },
                    { value: "intermediate", label: "Системийн промпт, role-play, chain-of-thought ашигладаг" },
                    { value: "advanced", label: "Дэвшилтэт техникүүд (few-shot, RAG, function calling) ашигладаг" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuizAnswers((p) => ({ ...p, q1: opt.value }))}
                      className={optionClass(quizAnswers.q1 === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q2: AI Tools */}
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]">
                  2. AI хэрэгслийн мэдлэг
                </label>
                <div className="space-y-2">
                  {[
                    { value: "none", label: "Ямар ч AI хэрэгсэл ашиглаагүй" },
                    { value: "chatgpt", label: "Зөвхөн ChatGPT ашиглаж үзсэн" },
                    { value: "multiple", label: "Олон AI (Claude, Midjourney, Cursor гэх мэт) ашигладаг" },
                    { value: "api", label: "API ашиглаж апп бүтээсэн / автоматжуулалт хийсэн" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuizAnswers((p) => ({ ...p, q2: opt.value }))}
                      className={optionClass(quizAnswers.q2 === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Q3: Goal */}
              <div>
                <label className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]">
                  3. Зорилго
                </label>
                <div className="space-y-2">
                  {[
                    { value: "learn", label: "AI гэж юу болохыг ойлгохыг хүсэж байна" },
                    { value: "use", label: "Ажилдаа AI ашиглаж бүтээмжээ нэмэгдүүлэх" },
                    { value: "build", label: "AI-р бүтээгдэхүүн/хэрэгсэл бүтээх" },
                    { value: "business", label: "AI бизнес эхлүүлэх / орлого олох" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setQuizAnswers((p) => ({ ...p, q3: opt.value }))}
                      className={optionClass(quizAnswers.q3 === opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleQuizSubmit}
              disabled={!quizComplete}
              className="mt-6 w-full rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              Үр дүнг харах
            </button>

            <p className="mt-4 text-center text-[12px] text-[#888888]">
              Бүртгэлтэй юу?{" "}
              <Link href="/auth/signin" className="text-[#EF2C58] transition hover:brightness-110">
                Нэвтрэх
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result Step ───
  if (step === "result" && aiLevel) {
    const levelColors = {
      beginner: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", text: "#16a34a" },
      intermediate: { bg: "rgba(239,44,88,0.06)", border: "rgba(239,44,88,0.3)", text: "#EF2C58" },
      advanced: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)", text: "#8b5cf6" },
    };
    const colors = levelColors[aiLevel.level as keyof typeof levelColors] || levelColors.beginner;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-[440px]">
          <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-8 text-center">
            <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[#888888]">
              Таны AI боловсролын түвшин
            </div>

            <div
              className="mx-auto mb-4 inline-block rounded-[4px] px-6 py-3 text-[20px] font-bold"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
            >
              {aiLevel.label}
            </div>

            <p className="mb-6 text-[13px] text-[#666666]">
              {aiLevel.description}
            </p>

            <div className="mb-6 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] p-4 text-left">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#888888] mb-2">
                Танд санал болгох сургалт
              </div>
              {aiLevel.level === "beginner" && (
                <ul className="space-y-1.5 text-[13px] text-[#1A1A1A]">
                  <li>• AI-н үндсэн ойлголт, хэрэглээ</li>
                  <li>• ChatGPT, Claude ашиглах арга</li>
                  <li>• Промпт бичих анхан шатны дадлага</li>
                </ul>
              )}
              {aiLevel.level === "intermediate" && (
                <ul className="space-y-1.5 text-[13px] text-[#1A1A1A]">
                  <li>• Промпт инженерингийн дэвшилтэт техник</li>
                  <li>• AI автоматжуулалт, workflow</li>
                  <li>• AI-р контент, дизайн бүтээх</li>
                </ul>
              )}
              {aiLevel.level === "advanced" && (
                <ul className="space-y-1.5 text-[13px] text-[#1A1A1A]">
                  <li>• API интеграци, custom AI app</li>
                  <li>• RAG, Agent, Function calling</li>
                  <li>• AI бизнес, SaaS бүтээгдэхүүн</li>
                </ul>
              )}
            </div>

            <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] p-4 mb-6">
              <div className="text-[24px] font-bold text-[#EF2C58]">29,000₮</div>
              <div className="text-[12px] text-[#888888]">сарын гишүүнчлэл · бүх түвшний сургалт</div>
            </div>

            <button
              onClick={() => setStep("register")}
              className="w-full rounded-[4px] bg-[#EF2C58] py-3 text-[14px] font-bold text-white transition hover:brightness-110"
            >
              Бүртгүүлэх — 29,000₮/сар
            </button>

            <button
              onClick={() => { setStep("quiz"); setAiLevel(null); }}
              className="mt-3 text-[12px] text-[#888888] transition hover:text-[#1A1A1A]"
            >
              Дахин шалгах
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Register Step ───
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[400px]">
        <div className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-8">
          {aiLevel && (
            <div
              className="mb-4 inline-block rounded-[4px] px-3 py-1 text-[11px] font-bold"
              style={{
                backgroundColor: aiLevel.level === "beginner" ? "rgba(34,197,94,0.08)" : aiLevel.level === "intermediate" ? "rgba(239,44,88,0.06)" : "rgba(139,92,246,0.08)",
                color: aiLevel.level === "beginner" ? "#16a34a" : aiLevel.level === "intermediate" ? "#EF2C58" : "#8b5cf6",
              }}
            >
              {aiLevel.label} түвшин
            </div>
          )}
          <h1 className="mb-1 text-[22px] font-bold text-[#1A1A1A]">
            Бүртгүүлэх
          </h1>
          <p className="mb-6 text-[12px] text-[#888888]">
            Antaqor-д нэгдэх · 29,000₮/сар
          </p>

          {error && (
            <div className="mb-5 rounded-[4px] bg-[rgba(239,44,88,0.06)] border border-[rgba(239,44,88,0.15)] px-4 py-3 text-[12px] text-[#EF2C58]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#666666]">
                Нэр
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#888888]"
                placeholder="Таны нэр"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#666666]">
                Утас
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                required
                maxLength={8}
                className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#888888]"
                placeholder="9911 2233"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#666666]">
                Имэйл
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#888888]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#666666]">
                Нууц үг
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#F8F8F6] px-3 py-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#888888]"
                placeholder="6+ тэмдэгт"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#888888]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#EF2C58] transition hover:brightness-110">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
