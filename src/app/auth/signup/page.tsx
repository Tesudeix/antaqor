"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Tightened to 4 chips that fit one row on mobile.
// Icons map semantically: academic-cap → bolt → chevrons-up → sparkles.
const AI_LEVELS: { value: string; label: string; iconPath: string }[] = [
  {
    value: "beginner",
    label: "Шинэхэн",
    iconPath:
      "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342",
  },
  { value: "intermediate", label: "Дунд", iconPath: "M13 10V3L4 14h7v7l9-11h-7z" },
  { value: "advanced", label: "Ахисан", iconPath: "M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5" },
  {
    value: "expert",
    label: "Мэргэжилтэн",
    iconPath:
      "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z",
  },
];

// Suggested 30-day learning path per AI level. Drives trust before payment by
// showing concretely what the user would learn — not just "Cyber Empire access".
const LEVEL_PATH: Record<
  string,
  { headline: string; sub: string; weeks: { title: string; outcome: string }[] }
> = {
  beginner: {
    headline: "30 хоногт ChatGPT-ээр ажил хөнгөвчлөх",
    sub: "AI-г анх удаа ашиглаж буй хүнд зориулсан суурь зам.",
    weeks: [
      { title: "1-р долоо хоног · ChatGPT суурь", outcome: "Үндсэн промпт бичих, өдөр тутамд ашиглах" },
      { title: "2-р долоо хоног · Promt template", outcome: "Бэлэн template-ээр ажлаа 3x хурдан хийх" },
      { title: "3-р долоо хоног · Контент үүсгэх", outcome: "Соц сүлжээний пост, имэйл, презентаци үүсгэх" },
      { title: "4-р долоо хоног · Анхны AI tool", outcome: "Бизнестээ зориулж 1 жижиг tool ажиллуулах" },
    ],
  },
  intermediate: {
    headline: "30 хоногт Promt инженер болох",
    sub: "ChatGPT/Claude-ийн чадварыг бүрэн нээж, ажлаа автоматжуулах.",
    weeks: [
      { title: "1-р долоо хоног · Promt engineering", outcome: "Chain-of-thought, few-shot, role prompting" },
      { title: "2-р долоо хоног · API + n8n", outcome: "OpenAI API-аар workflow-уудыг автоматжуулах" },
      { title: "3-р долоо хоног · Custom agent", outcome: "Өөрийн ажилд зориулсан AI ассистент бүтээх" },
      { title: "4-р долоо хоног · Бизнес case", outcome: "Бодит бизнесийн процесст AI шингээх" },
    ],
  },
  advanced: {
    headline: "30 хоногт AI бизнес эхлүүлэх",
    sub: "Promt дээр зогсохгүй — AI-аар орлого олох систем барих.",
    weeks: [
      { title: "1-р долоо хоног · Multi-agent orchestration", outcome: "Хэд хэдэн агентыг хамтад нь ажиллуулах" },
      { title: "2-р долоо хоног · RAG + custom data", outcome: "Өөрийн өгөгдөл дээр ажилладаг AI үүсгэх" },
      { title: "3-р долоо хоног · SaaS прототайп", outcome: "Эхний хэрэглэгчид зорилговч жижиг AI tool" },
      { title: "4-р долоо хоног · Launch + sales", outcome: "Бүтээгдэхүүнээ зарж эхний орлого авах" },
    ],
  },
  expert: {
    headline: "30 хоногт AI бүтээгдэхүүн scale хийх",
    sub: "Production-grade AI системийг хурдан хөгжүүлэх community.",
    weeks: [
      { title: "1-р долоо хоног · Production agent", outcome: "Eval, observability, fallback strategy" },
      { title: "2-р долоо хоног · Cost + latency optim", outcome: "Token cost-ыг 50%+ хэмнэх" },
      { title: "3-р долоо хоног · Fine-tune + custom model", outcome: "Тусгай domain-д зориулсан загвар" },
      { title: "4-р долоо хоног · Team + scale", outcome: "AI бүтээгчдийн нэгдэл, mentorship" },
    ],
  },
};

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

function SignUp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [aiLevel, setAiLevel] = useState<string>("intermediate");
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

  const handleAvatarFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл сонгоно уу");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Зураг 5MB-аас бага байх ёстой");
      return;
    }
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
      const signInRes = await signIn("credentials", {
        login: email.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError(signInRes.error);
        setLoading(false);
        setProgress("");
        return;
      }

      // Avatar upload — non-blocking. If it fails, signup still proceeds.
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

  const path = LEVEL_PATH[aiLevel] || LEVEL_PATH.intermediate;

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[440px] flex-col px-4 py-6">
      {/* Referrer banner */}
      {referrer && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-center gap-2.5 rounded-[8px] border border-[rgba(239,44,88,0.22)] bg-[rgba(239,44,88,0.06)] p-2.5"
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
      )}

      <form onSubmit={handleSubmit} className="rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5 md:p-6">
        {/* Header */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-2 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
          <span className="text-[9px] font-bold tracking-[0.14em] text-[#22C55E]">30 СЕКУНД</span>
        </div>
        <h1 className="mt-2 text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[28px]">Бүртгүүлэх</h1>
        <p className="mt-1 text-[12px] text-[#666]">Та юу сурахаа эхлээд харна уу.</p>

        {/* Avatar — drag-drop / tap-to-upload */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Профайл зураг</span>
            <span className="text-[10px] text-[#555]">заавал биш</span>
          </div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleAvatarFile(e.dataTransfer.files?.[0]);
            }}
            className={`group relative flex cursor-pointer items-center gap-3.5 rounded-[10px] border-2 border-dashed p-3 transition ${
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
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#22C55E] ring-2 ring-[#0F0F10]">
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
              <div className="mt-0.5 text-[10px] text-[#666]">
                JPEG / PNG / WebP · 5MB хүртэл
              </div>
            </div>
            {avatarPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setAvatarFile(null);
                  setAvatarPreview("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="shrink-0 rounded-full p-1.5 text-[#666] transition hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]"
                aria-label="Зураг устгах"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleAvatarFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>

        {/* AI level chips */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">AI түвшин</span>
            <span className="text-[10px] text-[#555]">дараа өөрчилж болно</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {AI_LEVELS.map((lvl) => {
              const active = aiLevel === lvl.value;
              return (
                <motion.button
                  key={lvl.value}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setAiLevel(lvl.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-[8px] border py-2.5 transition ${
                    active
                      ? "border-[#EF2C58] bg-[rgba(239,44,88,0.08)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] hover:border-[rgba(239,44,88,0.3)]"
                  }`}
                >
                  <svg
                    className={`h-4 w-4 transition ${active ? "text-[#EF2C58]" : "text-[#888]"}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.6}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={lvl.iconPath} />
                  </svg>
                  <span className={`text-[10px] font-bold ${active ? "text-[#EF2C58]" : "text-[#CCC]"}`}>
                    {lvl.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Level-tailored learning path — trust before payment */}
        <AnimatePresence mode="wait">
          <motion.div
            key={aiLevel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="mt-3 overflow-hidden rounded-[10px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.05)] via-[#0E0E0E] to-[#0B0B0B] p-3.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[rgba(239,44,88,0.15)] px-1.5 py-0.5 text-[9px] font-black tracking-[0.1em] text-[#EF2C58]">
                ТАНЫ ЗАМ
              </span>
              <span className="text-[10px] font-semibold text-[#888]">30 хоног · 4 долоо хоног</span>
            </div>
            <h3 className="mt-1.5 text-[13px] font-black leading-tight text-[#E8E8E8]">{path.headline}</h3>
            <p className="mt-0.5 text-[10px] leading-tight text-[#777]">{path.sub}</p>
            <ul className="mt-2.5 space-y-1.5">
              {path.weeks.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[9px] font-black text-[#EF2C58]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="text-[11px] font-bold text-[#E8E8E8]">{w.title}</div>
                    <div className="text-[10px] text-[#666]">→ {w.outcome}</div>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        {/* Fields */}
        <div className="mt-4 space-y-2.5">
          <Field label="Нэр" value={name} onChange={setName} placeholder="Жишээ: Болд" autoFocus />
          <Field
            label="Утас"
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 8))}
            placeholder="99112233"
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
              className="mt-3 rounded-[6px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={loading}
          className="group relative mt-4 w-full overflow-hidden rounded-[10px] bg-[#EF2C58] py-3.5 text-[14px] font-black text-white shadow-[0_0_28px_rgba(239,44,88,0.25)] transition hover:shadow-[0_0_44px_rgba(239,44,88,0.4)] disabled:opacity-70"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            {loading ? progress || "Үүсгэж байна..." : "Эхлэх"}
            {!loading && (
              <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </span>
          {!loading && (
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          )}
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
        <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
          Нэвтрэх
        </Link>
      </p>
    </div>
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
    hintTone === "warn" ? "text-[#FFB020]" : hintTone === "ok" ? "text-[#22C55E]" : "text-[#555]";
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
        className="w-full rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
      />
    </label>
  );
}
