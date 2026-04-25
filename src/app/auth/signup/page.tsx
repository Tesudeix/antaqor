"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Tightened to 4 chips that fit one row on mobile.
// Icons map semantically: sprout (beginner) → bolt (intermediate) → rocket (advanced) → atom (expert).
const AI_LEVELS: { value: string; label: string; iconPath: string }[] = [
  {
    value: "beginner",
    label: "Шинэхэн",
    // academic cap — student
    iconPath: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342",
  },
  {
    value: "intermediate",
    label: "Дунд",
    // lightning bolt
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  {
    value: "advanced",
    label: "Ахисан",
    // double chevron up = levelling up
    iconPath: "M4.5 12.75l7.5-7.5 7.5 7.5m-15 6l7.5-7.5 7.5 7.5",
  },
  {
    value: "expert",
    label: "Мэргэжилтэн",
    // sparkle / mastery
    iconPath: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z",
  },
];

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

  const [aiLevel, setAiLevel] = useState<string>("intermediate");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Referral resolution from ?ref=
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
        return;
      }

      const signInRes = await signIn("credentials", {
        login: email.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError(signInRes.error);
        setLoading(false);
        return;
      }

      router.push("/clan?pay=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-6">
      <div className="w-full max-w-[420px]">
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
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-2 py-0.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
            <span className="text-[9px] font-bold tracking-[0.14em] text-[#22C55E]">30 СЕКУНД</span>
          </div>
          <h1 className="mt-2 text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[28px]">
            Бүртгүүлэх
          </h1>
          <p className="mt-1 text-[12px] text-[#666]">
            4 талбар. 1 товч. Тэгээд community-д орно.
          </p>

          {/* AI level chips — segmented control */}
          <div className="mt-5">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">
              AI түвшин
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

          {/* Fields */}
          <div className="mt-4 space-y-2.5">
            <Field label="Нэр" value={name} onChange={setName} placeholder="Жишээ: Болд" autoFocus />
            <Field label="Утас" value={phone} onChange={(v) => setPhone(v.replace(/[^\d+\-\s]/g, ""))} placeholder="99112233" type="tel" />
            <Field label="Имэйл" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            <Field label="Нууц үг" value={password} onChange={setPassword} placeholder="6+ тэмдэгт" type="password" />
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
              {loading ? "Үүсгэж байна..." : "Эхлэх"}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoFocus={autoFocus}
        autoComplete={type === "password" ? "new-password" : type === "email" ? "email" : "off"}
        className="w-full rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] text-[#E8E8E8] placeholder-[#444] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
      />
    </label>
  );
}
