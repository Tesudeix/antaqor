"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── AI level options — one-tap, minimal ───
const AI_LEVELS = [
  { value: "beginner", label: "Шинэхэн", sub: "AI-г анх удаа туршиж байна", icon: "🌱" },
  { value: "intermediate", label: "Дунд", sub: "ChatGPT, Claude ашигладаг", icon: "⚡" },
  { value: "advanced", label: "Ахисан", sub: "Prompt engineering, automation", icon: "🚀" },
  { value: "expert", label: "Мэргэжилтэн", sub: "API, agent, бизнест ашигладаг", icon: "🧠" },
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
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"level" | "details">("level");
  const [aiLevel, setAiLevel] = useState<string>("");

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [password, setPassword] = useState("");

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

  const pickLevel = (value: string) => {
    setAiLevel(value);
    setTimeout(() => setStep("details"), 220);
  };

  const onAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("Зураг 10MB-аас бага байх ёстой");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(String(ev.target?.result || ""));
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    if (!name.trim()) return "Нэрээ оруулна уу";
    if (!phone.trim() || phone.trim().length < 6) return "Утасны дугаараа шалгана уу";
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
          instagram: instagram.trim(),
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

      // Optional avatar upload after auto-signin
      if (avatarFile) {
        try {
          setProgress("Профайл зураг байршуулж байна...");
          const fd = new FormData();
          fd.append("file", avatarFile);
          const up = await fetch("/api/upload", { method: "POST", body: fd });
          const upData = await up.json();
          if (up.ok && upData.url && data.user?.id) {
            await fetch(`/api/users/${data.user.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ avatar: upData.url }),
            });
          }
        } catch {
          /* non-blocking */
        }
      }

      router.push("/clan?pay=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      setLoading(false);
      setProgress("");
    }
  };

  // ─── Referrer banner (shown across all steps) ───
  const ReferrerBanner = referrer ? (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-2.5 rounded-[6px] border border-[rgba(239,44,88,0.22)] bg-[rgba(239,44,88,0.06)] p-2.5"
    >
      {referrer.avatar ? (
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
  ) : null;

  // ─── Step 1: one-tap AI level ───
  if (step === "level") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-[440px]">
          {ReferrerBanner}
          <div className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#111] p-6">
            <div className="mb-1 flex items-center gap-2">
              <div className="h-[2px] w-4 bg-[#EF2C58]" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-[#EF2C58]">АЛХАМ 1 / 2</span>
            </div>
            <h1 className="mt-2 text-[22px] font-black leading-tight text-[#E8E8E8] md:text-[26px]">
              AI туршлагаа сонгоно уу
            </h1>
            <p className="mt-1 text-[12px] text-[#666]">
              Таны түвшинд тохирсон контентыг санал болгоно.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              {AI_LEVELS.map((lvl) => (
                <motion.button
                  key={lvl.value}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => pickLevel(lvl.value)}
                  className={`group rounded-[8px] border p-3.5 text-left transition ${
                    aiLevel === lvl.value
                      ? "border-[#EF2C58] bg-[rgba(239,44,88,0.08)]"
                      : "border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] hover:border-[rgba(239,44,88,0.3)]"
                  }`}
                >
                  <div className="text-[22px] leading-none">{lvl.icon}</div>
                  <div className="mt-2.5 text-[13px] font-bold text-[#E8E8E8]">{lvl.label}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-[#666]">{lvl.sub}</div>
                </motion.button>
              ))}
            </div>

            <button
              onClick={() => setStep("details")}
              className="mt-4 w-full text-[11px] font-semibold text-[#666] transition hover:text-[#EF2C58]"
            >
              Алгасах →
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-[#555]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Step 2: compact registration ───
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[440px]">
        {ReferrerBanner}
        <form onSubmit={handleSubmit} className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#111] p-6">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-[2px] w-4 bg-[#EF2C58]" />
              <span className="text-[10px] font-bold tracking-[0.18em] text-[#EF2C58]">АЛХАМ 2 / 2</span>
            </div>
            <button
              type="button"
              onClick={() => setStep("level")}
              className="text-[11px] text-[#666] transition hover:text-[#E8E8E8]"
            >
              ← Буцах
            </button>
          </div>

          <h2 className="mt-2 text-[22px] font-black leading-tight text-[#E8E8E8] md:text-[26px]">
            Бүртгэл үүсгэх
          </h2>
          <p className="mt-1 text-[12px] text-[#666]">
            30 секундэд дуусна. Зөвхөн шаардлагатай зүйл.
          </p>

          {/* Avatar upload — optional but visually prominent */}
          <div className="mt-5 flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] transition hover:border-[rgba(239,44,88,0.4)]"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="avatar preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#555] group-hover:text-[#EF2C58]">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5" />
                  </svg>
                </div>
              )}
              {avatarPreview && (
                <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF2C58] ring-2 ring-[#111]">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
            </button>
            <div className="leading-tight">
              <div className="text-[12px] font-bold text-[#E8E8E8]">Профайл зураг</div>
              <div className="text-[10px] text-[#666]">Дур зоргоор · хожим ч оруулж болно</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
          </div>

          {/* Fields in conversion-optimized order */}
          <div className="mt-5 space-y-2.5">
            <Field
              label="Нэр"
              value={name}
              onChange={setName}
              placeholder="Жишээ: Болд"
              autoFocus
              required
            />
            <Field
              label="Утас"
              value={phone}
              onChange={setPhone}
              placeholder="99112233"
              type="tel"
              required
            />
            <Field
              label="Имэйл"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              type="email"
              required
            />
            <Field
              label="Instagram"
              value={instagram}
              onChange={(v) => setInstagram(v.replace(/^@+/, ""))}
              placeholder="username (заавал биш)"
              prefix="@"
              optional
            />
            <Field
              label="Нууц үг"
              value={password}
              onChange={setPassword}
              placeholder="6+ тэмдэгт"
              type="password"
              required
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
            className="group relative mt-5 w-full overflow-hidden rounded-[8px] bg-[#EF2C58] py-3.5 text-[14px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.2)] transition-all duration-200 hover:shadow-[0_0_36px_rgba(239,44,88,0.35)] disabled:opacity-70"
          >
            <span className="relative z-10">{loading ? progress || "..." : "Бүртгэл үүсгэх"}</span>
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

        <p className="mt-4 text-center text-[11px] text-[#555]">
          Бүртгэлтэй юу?{" "}
          <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Small reusable field ───
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  optional,
  prefix,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  prefix?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">{label}</span>
        {required && <span className="text-[9px] text-[#EF2C58]">·</span>}
        {optional && <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[8px] font-bold text-[#555]">заавал биш</span>}
      </div>
      <div className="flex items-center gap-0 rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] transition focus-within:border-[rgba(239,44,88,0.4)]">
        {prefix && <span className="pl-3 text-[13px] text-[#555]">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          autoFocus={autoFocus}
          autoComplete={type === "password" ? "new-password" : "off"}
          className="w-full bg-transparent px-3 py-2.5 text-[14px] text-[#E8E8E8] placeholder-[#444] outline-none"
        />
      </div>
    </label>
  );
}
