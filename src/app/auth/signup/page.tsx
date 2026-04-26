"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Quiz: 3 questions, each with 4 SVG-icon options ───
type AnswerKey = "q1" | "q2" | "q3";
interface Option {
  value: string;
  label: string;
  iconPath: string;
}
interface Question {
  id: AnswerKey;
  label: string;
  iconPath: string; // header chip icon
  options: Option[];
}

const QUESTIONS: Question[] = [
  {
    id: "q1",
    label: "Промпт инженерингийн туршлага",
    iconPath:
      "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    options: [
      {
        value: "none",
        label: "Анх удаа санаж байна",
        // academic-cap (student)
        iconPath:
          "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84",
      },
      {
        value: "basic",
        label: "ChatGPT-д энгийн асуулт бичиж байсан",
        // chat bubble
        iconPath:
          "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z",
      },
      {
        value: "intermediate",
        label: "System prompt, chain-of-thought ашигладаг",
        // bolt
        iconPath: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
      },
      {
        value: "advanced",
        label: "Few-shot, RAG, function calling",
        // chevron-double-up = mastery climb
        iconPath: "M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5",
      },
    ],
  },
  {
    id: "q2",
    label: "AI хэрэгслийн мэдлэг",
    iconPath:
      "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75",
    options: [
      {
        value: "none",
        label: "Ямар ч AI ашиглаж үзээгүй",
        // closed package box
        iconPath:
          "M21 8.25v7.5a2.25 2.25 0 01-1.183 1.981l-6.75 3.6a2.25 2.25 0 01-2.134 0l-6.75-3.6A2.25 2.25 0 013 15.75v-7.5m18 0a2.25 2.25 0 00-1.183-1.981L13.067 2.67a2.25 2.25 0 00-2.134 0L4.183 6.27A2.25 2.25 0 003 8.25M21 8.25l-9 4.875M3 8.25l9 4.875m0 0V21",
      },
      {
        value: "chatgpt",
        label: "Зөвхөн ChatGPT",
        // cpu (chip)
        iconPath:
          "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25",
      },
      {
        value: "multiple",
        label: "Claude, Midjourney, Cursor зэрэг 2+",
        // squares-2x2 (multiple apps)
        iconPath:
          "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z",
      },
      {
        value: "api",
        label: "API дээр өөрөө апп бүтээсэн",
        // code brackets
        iconPath:
          "M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z",
      },
    ],
  },
  {
    id: "q3",
    label: "Та юу хийхийг хүсэж байна?",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    options: [
      {
        value: "learn",
        label: "AI-г ойлгож сурах",
        // book-open
        iconPath:
          "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25",
      },
      {
        value: "use",
        label: "Ажилдаа AI ашиглах",
        // briefcase
        iconPath:
          "M20.25 14.15v4.073a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-4.072m16.5 0a24.301 24.301 0 01-4.5.659 24.317 24.317 0 01-4.5-.659m16.5 0v-2.073A2.25 2.25 0 0017.999 9.75h-12A2.25 2.25 0 003.75 12.077v2.073M12 9.75v.008v-.008zm0 0h0M16.5 9.75v-.75A2.25 2.25 0 0014.25 6.75h-4.5A2.25 2.25 0 007.5 9v.75",
      },
      {
        value: "build",
        label: "AI-р бүтээгдэхүүн бүтээх",
        // wrench-screwdriver
        iconPath:
          "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085",
      },
      {
        value: "business",
        label: "AI бизнес эхлүүлж орлого олох",
        // currency
        iconPath:
          "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      },
    ],
  },
];

type Answers = Record<AnswerKey, string>;
const EMPTY_ANSWERS: Answers = { q1: "", q2: "", q3: "" };

const LEVEL_CONFIG: Record<
  string,
  { label: string; tag: string; sub: string; paths: string[]; ringColor: string }
> = {
  beginner: {
    label: "Шинэхэн",
    tag: "BEGINNER",
    sub: "AI-н үндсэн ойлголтуудаас эхэлж 30 хоногт ChatGPT-ээр өдөр тутамд тусдаг түвшинд хүргэнэ.",
    paths: [
      "ChatGPT, Claude-ийн суурь дадлага",
      "Бэлэн promt template-ээр ажил хөнгөвчлөх",
      "Эхлэгчдийн challenge — XP цуглуулах",
    ],
    ringColor: "#EF2C58",
  },
  intermediate: {
    label: "Дунд",
    tag: "INTERMEDIATE",
    sub: "Promt инженеринг, AI workflow автоматжуулалтаар ажлаа 3x хурдан хийдэг болгоно.",
    paths: [
      "Promt engineering — chain-of-thought, few-shot",
      "n8n / Make-аар workflow автоматжуулах",
      "Custom AI ассистент бүтээх challenge",
    ],
    ringColor: "#EF2C58",
  },
  advanced: {
    label: "Ахисан",
    tag: "ADVANCED",
    sub: "RAG, multi-agent, custom data — production-grade AI tool бүтээж монетизаци хийнэ.",
    paths: [
      "Multi-agent orchestration & RAG",
      "API + бизнесийн workflow интеграц",
      "AI SaaS прототайп — launch challenge",
    ],
    ringColor: "#A855F7",
  },
};

function calculateLevel(answers: Answers): "beginner" | "intermediate" | "advanced" {
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

  if (score <= 2) return "beginner";
  if (score <= 5) return "intermediate";
  return "advanced";
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </div>
      }
    >
      <SignUp />
    </Suspense>
  );
}

type Step = "quiz" | "result" | "register";

function SignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  // Quiz state
  const [step, setStep] = useState<Step>("quiz");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [aiLevel, setAiLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  // Register state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");

  // Referral
  const [referralCode, setReferralCode] = useState<string>("");
  const [referrer, setReferrer] = useState<{ name: string; avatar?: string } | null>(null);

  useEffect(() => {
    const fromUrl = searchParams?.get("ref");
    if (!fromUrl) return;
    const code = fromUrl.trim().toLowerCase();
    setReferralCode(code);
    fetch(`/api/referral/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user) setReferrer({ name: d.user.name, avatar: d.user.avatar }); })
      .catch(() => {});
  }, [searchParams]);

  const pickOption = (qId: AnswerKey, value: string) => {
    const next = { ...answers, [qId]: value };
    setAnswers(next);
    setTimeout(() => {
      if (currentQ < QUESTIONS.length - 1) {
        setCurrentQ((c) => c + 1);
      } else {
        setAiLevel(calculateLevel(next));
        setStep("result");
      }
    }, 280);
  };

  const handleAvatarFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Зөвхөн зургийн файл сонгоно уу"); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Зураг 5MB-аас бага байх ёстой"); return; }
    setError("");
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(String(ev.target?.result || ""));
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Нэрээ оруулна уу";
    if (!phone.trim() || phone.replace(/\D/g, "").length < 8) return "Утасны дугаар 8 оронтой байх ёстой";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return "Имэйл буруу байна";
    if (!password || password.length < 6) return "Нууц үг 6+ тэмдэгт байх ёстой";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }

    setLoading(true);
    setProgress("Бүртгэл үүсгэж байна...");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password,
          aiExperience: aiLevel,
          referralCode: referralCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Бүртгэл амжилтгүй");
        setLoading(false);
        setProgress("");
        return;
      }

      setProgress("Нэвтэрч байна...");
      const signInRes = await signIn("credentials", { login: email.trim(), password, redirect: false });
      if (signInRes?.error) {
        setError(signInRes.error);
        setLoading(false);
        setProgress("");
        return;
      }

      if (avatarFile && data.user?.id) {
        try {
          setProgress("Профайл зураг хадгалж байна...");
          const fd = new FormData();
          fd.append("file", avatarFile);
          const up = await fetch("/api/upload", { method: "POST", body: fd });
          const upData = await up.json();
          if (up.ok && upData.url) {
            await fetch(`/api/users/${data.user.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ avatar: upData.url }),
            });
          }
        } catch { /* non-blocking */ }
      }

      router.push("/clan?pay=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      setLoading(false);
      setProgress("");
    }
  };

  // ─── QUIZ ─────────────────────────────────────────────────────────────
  if (step === "quiz") {
    const q = QUESTIONS[currentQ];
    const current = answers[q.id];
    const pct = ((currentQ + (current ? 1 : 0)) / QUESTIONS.length) * 100;

    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[460px] flex-col px-4 py-6">
        {referrer && <ReferrerBanner referrer={referrer} />}
        <div className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10]">
          {/* Progress */}
          <div className="h-[3px] bg-[#1A1A1A]">
            <motion.div
              className="h-full bg-[#EF2C58]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
                <svg className="h-3.5 w-3.5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={q.iconPath} />
                </svg>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#888]">
                {currentQ + 1} / {QUESTIONS.length}
              </span>
            </div>

            <motion.h1
              key={`q-${currentQ}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 text-[20px] font-black leading-tight text-[#E8E8E8] md:text-[22px]"
            >
              {q.label}
            </motion.h1>

            <AnimatePresence mode="wait">
              <motion.div
                key={`opts-${currentQ}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="mt-5 space-y-2"
              >
                {q.options.map((opt, i) => {
                  const selected = current === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: i * 0.05 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => pickOption(q.id, opt.value)}
                      className={`flex w-full items-center gap-3 rounded-[4px] border px-3.5 py-3 text-left transition ${
                        selected
                          ? "border-[#EF2C58] bg-[rgba(239,44,88,0.08)]"
                          : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] hover:border-[rgba(239,44,88,0.3)]"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] transition ${
                          selected ? "bg-[#EF2C58] text-white" : "bg-[#141414] text-[#888]"
                        }`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={opt.iconPath} />
                        </svg>
                      </span>
                      <span className={`flex-1 text-[13px] ${selected ? "font-bold text-[#E8E8E8]" : "text-[#CCC]"}`}>
                        {opt.label}
                      </span>
                      {selected && (
                        <motion.svg
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="h-4 w-4 text-[#EF2C58]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </motion.svg>
                      )}
                    </motion.button>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => currentQ > 0 && setCurrentQ((c) => c - 1)}
                disabled={currentQ === 0}
                className="text-[11px] font-semibold text-[#666] transition hover:text-[#E8E8E8] disabled:opacity-30"
              >
                ← Буцах
              </button>
              <button
                type="button"
                onClick={() => { setAiLevel(calculateLevel({ ...answers, q1: answers.q1 || "none", q2: answers.q2 || "none", q3: answers.q3 || "learn" })); setStep("result"); }}
                className="text-[11px] font-semibold text-[#666] transition hover:text-[#EF2C58]"
              >
                Алгасах →
              </button>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-[#555]">
          Бүртгэлтэй юу?{" "}
          <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">Нэвтрэх</Link>
        </p>
      </div>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────
  if (step === "result") {
    const cfg = LEVEL_CONFIG[aiLevel];
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-[460px] flex-col px-4 py-6">
        {referrer && <ReferrerBanner referrer={referrer} />}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
          className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-6 text-center md:p-7"
        >
          {/* Trophy ring */}
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${cfg.ringColor}15`, boxShadow: `0 0 28px ${cfg.ringColor}30` }}>
            <svg className="h-7 w-7" fill="none" stroke={cfg.ringColor} strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
            </svg>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#888]">ТАНЫ AI ТҮВШИН</div>
          <h2
            className="mt-2 inline-block rounded-[4px] px-5 py-2 text-[22px] font-black"
            style={{ background: `${cfg.ringColor}14`, border: `1px solid ${cfg.ringColor}40`, color: cfg.ringColor }}
          >
            {cfg.label}
          </h2>
          <p className="mx-auto mt-3 max-w-[340px] text-[12px] leading-relaxed text-[#999]">{cfg.sub}</p>

          {/* Path */}
          <div className="mt-5 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4 text-left">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">ТАНД ТОХИРОХ ЗАМ</div>
            <ul className="mt-2.5 space-y-1.5">
              {cfg.paths.map((p, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="flex items-start gap-2"
                >
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.ringColor }} />
                  <span className="text-[12px] leading-tight text-[#CCC]">{p}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setStep("register")}
            className="group relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[4px] bg-[#EF2C58] py-3.5 text-[14px] font-black text-white shadow-[0_0_28px_rgba(239,44,88,0.25)] transition hover:bg-[#D4264E]"
          >
            Cyber Empire нэгдэх
            <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          <button
            onClick={() => { setStep("quiz"); setCurrentQ(0); setAnswers(EMPTY_ANSWERS); }}
            className="mt-3 text-[11px] font-semibold text-[#666] transition hover:text-[#E8E8E8]"
          >
            Дахин шалгах
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── REGISTER ─────────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[440px] flex-col px-4 py-6">
      {referrer && <ReferrerBanner referrer={referrer} />}

      <form onSubmit={handleSubmit} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5 md:p-6">
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-black tracking-[3px] text-[#E8E8E8]">ANTAQOR</span>
          <button
            type="button"
            onClick={() => setStep("result")}
            className="text-[11px] text-[#666] transition hover:text-[#E8E8E8]"
          >
            ← Буцах
          </button>
        </div>
        <h1 className="mt-3 text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[28px]">Бүртгүүлэх</h1>
        <p className="mt-1 text-[12px] text-[#666]">
          {LEVEL_CONFIG[aiLevel].label} түвшин · 4 талбар бөглөөд community-д орно
        </p>

        {/* Avatar */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Профайл зураг</span>
            <span className="text-[10px] text-[#555]">заавал биш</span>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleAvatarFile(e.dataTransfer.files?.[0]); }}
            className={`group relative flex cursor-pointer items-center gap-3.5 rounded-[4px] border-2 border-dashed p-3 transition ${
              dragOver
                ? "border-[#EF2C58] bg-[rgba(239,44,88,0.05)]"
                : "border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] hover:border-[rgba(239,44,88,0.4)]"
            }`}
          >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[#141414]">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#555] transition group-hover:text-[#EF2C58]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
              )}
              {avatarPreview && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF2C58] ring-2 ring-[#0F0F10]">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-[12px] font-bold text-[#E8E8E8]">
                {avatarPreview ? "Зургийг сольох" : "Зураг сонгох"}
              </div>
              <div className="mt-0.5 text-[10px] text-[#666]">JPEG / PNG / WebP · 5MB хүртэл</div>
            </div>
            {avatarPreview && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAvatarFile(null); setAvatarPreview(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="shrink-0 rounded-full p-1.5 text-[#666] transition hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
                aria-label="Зураг устгах"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => handleAvatarFile(e.target.files?.[0])} className="hidden" />
        </div>

        {/* Fields */}
        <div className="mt-4 space-y-2.5">
          <Field label="Нэр" value={name} onChange={setName} placeholder="Жишээ: Болд" autoFocus />
          <Field
            label="Утас"
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 8))}
            placeholder="Утасны дугаараа оруулна"
            type="tel"
            inputMode="numeric"
            maxLength={8}
            hint="8 оронтой"
          />
          <Field label="Имэйл" value={email} onChange={setEmail} placeholder="you@example.com" type="email" inputMode="email" />
          <Field
            label="Нууц үг"
            value={password}
            onChange={setPassword}
            placeholder="Доод тал нь 6 тэмдэгт"
            type="password"
            hint={password ? `${password.length} / 6+ тэмдэгт` : "6+ тэмдэгт"}
            hintTone={password && password.length < 6 ? "warn" : "muted"}
          />
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-4 w-full overflow-hidden rounded-[4px] bg-[#EF2C58] py-3.5 text-[14px] font-black text-white shadow-[0_0_28px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_44px_rgba(239,44,88,0.4)] disabled:opacity-70"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {loading ? progress || "Үүсгэж байна..." : "Эхлэх"}
            {!loading && (
              <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </span>
        </button>

        <p className="mt-3 text-center text-[10px] text-[#555]">
          Бүртгүүлснээр{" "}
          <Link href="/legal/terms" className="underline">нөхцөл</Link>
          {" · "}
          <Link href="/legal/privacy" className="underline">нууцлалыг</Link>{" "}
          зөвшөөрнө
        </p>
      </form>

      <p className="mt-3 text-center text-[11px] text-[#555]">
        Бүртгэлтэй юу?{" "}
        <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">Нэвтрэх</Link>
      </p>
    </div>
  );
}

function ReferrerBanner({ referrer }: { referrer: { name: string; avatar?: string } }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 flex items-center gap-2.5 rounded-[4px] border border-[rgba(239,44,88,0.22)] bg-[rgba(239,44,88,0.06)] p-2.5"
    >
      {referrer.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={referrer.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[12px] font-bold text-[#EF2C58]">
          {referrer.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-bold text-[#E8E8E8]">{referrer.name} урилсан</div>
        <div className="text-[10px] font-bold text-[#EF2C58]">+50 кредит бэлэг</div>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
  inputMode,
  maxLength,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal" | "url" | "search" | "none";
  maxLength?: number;
  hint?: string;
  hintTone?: "muted" | "warn" | "ok";
}) {
  const hintColor =
    hintTone === "warn" ? "text-[#FFB020]" : hintTone === "ok" ? "text-[#EF2C58]" : "text-[#555]";
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">{label}</span>
        {hint && <span className={`text-[10px] font-semibold ${hintColor}`}>{hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoFocus={autoFocus}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={
          type === "password" ? "new-password" : type === "email" ? "email" : type === "tel" ? "tel" : "off"
        }
        className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
      />
    </label>
  );
}
