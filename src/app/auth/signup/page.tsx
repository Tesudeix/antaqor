"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizAnswer {
  q1: string;
  q2: string;
  q3: string;
}

function calculateLevel(answers: QuizAnswer): { level: string; label: string; description: string } {
  let score = 0;
  if (answers.q1 === "basic") score += 1;
  else if (answers.q1 === "intermediate") score += 2;
  else if (answers.q1 === "advanced") score += 3;
  if (answers.q2 === "chatgpt") score += 1;
  else if (answers.q2 === "multiple") score += 2;
  else if (answers.q2 === "api") score += 3;
  if (answers.q3 === "use") score += 1;
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

const quizQuestions = [
  {
    id: "q1",
    label: "Промпт инженеринг туршлага",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    options: [
      { value: "none", label: "Мэдэхгүй / Анх удаа", emoji: "🌱" },
      { value: "basic", label: "ChatGPT-д энгийн асуулт бичих", emoji: "💬" },
      { value: "intermediate", label: "System prompt, chain-of-thought", emoji: "⚡" },
      { value: "advanced", label: "Few-shot, RAG, function calling", emoji: "🚀" },
    ],
  },
  {
    id: "q2",
    label: "AI хэрэгслийн мэдлэг",
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    options: [
      { value: "none", label: "Ямар ч AI ашиглаагүй", emoji: "📦" },
      { value: "chatgpt", label: "Зөвхөн ChatGPT", emoji: "🤖" },
      { value: "multiple", label: "Claude, Midjourney, Cursor гэх мэт", emoji: "🧰" },
      { value: "api", label: "API ашиглаж апп бүтээсэн", emoji: "👨‍💻" },
    ],
  },
  {
    id: "q3",
    label: "Зорилго",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    options: [
      { value: "learn", label: "AI-г ойлгохыг хүсэж байна", emoji: "📚" },
      { value: "use", label: "Ажилдаа AI ашиглах", emoji: "💼" },
      { value: "build", label: "AI-р бүтээгдэхүүн бүтээх", emoji: "🔧" },
      { value: "business", label: "AI бизнес эхлүүлэх", emoji: "💰" },
    ],
  },
];

export default function SignUp() {
  const router = useRouter();
  const [currentQ, setCurrentQ] = useState(0);
  const [step, setStep] = useState<"quiz" | "result" | "register">("quiz");
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer>({ q1: "", q2: "", q3: "" });
  const [aiLevel, setAiLevel] = useState<{ level: string; label: string; description: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAnswer = (qId: string, value: string) => {
    setQuizAnswers((p) => ({ ...p, [qId]: value }));
    // Auto-advance after a brief delay
    setTimeout(() => {
      if (currentQ < quizQuestions.length - 1) {
        setCurrentQ((c) => c + 1);
      } else {
        const answers = { ...quizAnswers, [qId]: value };
        const result = calculateLevel(answers);
        setAiLevel(result);
        setStep("result");
      }
    }, 300);
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
        router.push("/clan?pay=1");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Quiz Step ───
  if (step === "quiz") {
    const q = quizQuestions[currentQ];
    const currentAnswer = quizAnswers[q.id as keyof QuizAnswer];
    const progress = ((currentQ + (currentAnswer ? 1 : 0)) / quizQuestions.length) * 100;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-[440px]">
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] overflow-hidden">
            {/* Progress bar */}
            <div className="h-[3px] bg-[#1A1A1A]">
              <motion.div
                className="h-full bg-[#EF2C58]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>

            <div className="p-8">
              {/* Header */}
              <div className="mb-1 flex items-center gap-2">
                <motion.div
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(239,44,88,0.08)]"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <svg className="h-3.5 w-3.5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={q.icon} />
                  </svg>
                </motion.div>
                <span className="text-[10px] font-bold uppercase tracking-[1px] text-[#999]">
                  {currentQ + 1} / {quizQuestions.length}
                </span>
              </div>

              <motion.h1
                key={currentQ}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-6 text-[20px] font-bold text-[#E8E8E8]"
              >
                {q.label}
              </motion.h1>

              {/* Options */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-2"
                >
                  {q.options.map((opt, i) => {
                    const selected = currentAnswer === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.06 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleAnswer(q.id, opt.value)}
                        className={`flex w-full items-center gap-3 rounded-[4px] border px-4 py-3.5 text-left text-[13px] transition ${
                          selected
                            ? "border-[#EF2C58] bg-[rgba(239,44,88,0.06)] text-[#E8E8E8] font-semibold shadow-[0_0_0_1px_rgba(239,44,88,0.2)]"
                            : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] text-[#999999] hover:border-[rgba(0,0,0,0.15)] hover:bg-[#1A1A1A]"
                        }`}
                      >
                        <span className="text-[16px]">{opt.emoji}</span>
                        <span>{opt.label}</span>
                        {selected && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="ml-auto h-4 w-4 text-[#EF2C58]"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </motion.svg>
                        )}
                      </motion.button>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* Back button */}
              {currentQ > 0 && (
                <button
                  onClick={() => setCurrentQ((c) => c - 1)}
                  className="mt-4 text-[12px] text-[#888] transition hover:text-[#E8E8E8]"
                >
                  ← Буцах
                </button>
              )}

              <p className="mt-6 text-center text-[12px] text-[#999999]">
                Бүртгэлтэй юу?{" "}
                <Link href="/auth/signin" className="text-[#EF2C58] transition hover:brightness-110">
                  Нэвтрэх
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result Step ───
  if (step === "result" && aiLevel) {
    const levelConfig = {
      beginner: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", text: "#16a34a", emoji: "🌱", paths: ["AI-н үндсэн ойлголт, хэрэглээний дадлага", "ChatGPT, Claude ашиглах арга техник", "Эхлэгчдийн challenge, бодит даалгавар"] },
      intermediate: { bg: "rgba(239,44,88,0.06)", border: "rgba(239,44,88,0.3)", text: "#EF2C58", emoji: "⚡", paths: ["Промпт инженерингийн дэвшилтэт техник", "AI автоматжуулалт, бизнес workflow", "Өрсөлдөөнт challenge, багийн төсөл"] },
      advanced: { bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.3)", text: "#8b5cf6", emoji: "🚀", paths: ["API интеграци, AI бүтээгдэхүүн бүтээх", "RAG, Agent, Function calling дадлага", "AI бизнес challenge, SaaS өрсөлдөөн"] },
    };
    const config = levelConfig[aiLevel.level as keyof typeof levelConfig] || levelConfig.beginner;

    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-[440px]">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-3 text-[48px]"
            >
              {config.emoji}
            </motion.div>

            <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[#999999]">
              Таны AI түвшин
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mx-auto mb-4 inline-block rounded-[4px] px-6 py-3 text-[20px] font-bold"
              style={{ backgroundColor: config.bg, border: `1px solid ${config.border}`, color: config.text }}
            >
              {aiLevel.label}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-6 text-[13px] text-[#999999]"
            >
              {aiLevel.description}
            </motion.p>

            <div className="mb-6 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-4 text-left">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#999999] mb-3">
                Таны сургалтын зам
              </div>
              {config.paths.map((path, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-2 py-1.5 text-[13px] text-[#E8E8E8]"
                >
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: config.text }} />
                  {path}
                </motion.div>
              ))}
            </div>

            <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-4 mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-[24px] font-bold text-[#EF2C58]">49,000₮</span>
                <span className="text-[13px] text-[#888]">-оос</span>
              </div>
              <div className="text-[12px] text-[#999999]">сарын гишүүнчлэл · 3 түвшний сонголт</div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("register")}
              className="w-full rounded-[4px] bg-[#EF2C58] py-3 text-[14px] font-bold text-white transition hover:brightness-110"
            >
              Одоо эхлэх
            </motion.button>

            <button
              onClick={() => { setStep("quiz"); setCurrentQ(0); setAiLevel(null); setQuizAnswers({ q1: "", q2: "", q3: "" }); }}
              className="mt-3 text-[12px] text-[#999999] transition hover:text-[#E8E8E8]"
            >
              Дахин шалгах
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Register Step ───
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[400px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-8"
        >
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
          <h1 className="mb-1 text-[22px] font-bold text-[#E8E8E8]">
            Бүртгэл үүсгэх
          </h1>
          <p className="mb-6 text-[12px] text-[#999999]">
            Бүртгүүлсний дараа шууд төлбөр хийх боломжтой
          </p>

          {error && (
            <div className="mb-5 rounded-[4px] bg-[rgba(239,44,88,0.06)] border border-[rgba(239,44,88,0.15)] px-4 py-3 text-[12px] text-[#EF2C58]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Нэр", type: "text", value: name, set: setName, placeholder: "Таны нэр", min: 2 },
              { label: "Утас", type: "tel", value: phone, set: (v: string) => setPhone(v.replace(/[^0-9]/g, "")), placeholder: "9911 2233", max: 8 },
              { label: "Имэйл", type: "email", value: email, set: setEmail, placeholder: "you@example.com" },
              { label: "Нууц үг", type: "password", value: password, set: setPassword, placeholder: "6+ тэмдэгт", min: 6 },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1.5 block text-[12px] font-medium text-[#999999]">{f.label}</label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  required
                  minLength={f.min}
                  maxLength={f.max}
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#999999]"
                  placeholder={f.placeholder}
                />
              </div>
            ))}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
            </motion.button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#999999]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#EF2C58] transition hover:brightness-110">
              Нэвтрэх
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
