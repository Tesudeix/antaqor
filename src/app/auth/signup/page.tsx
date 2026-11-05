"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { track, trackOnce } from "@/lib/analytics";
import { isPaidPlanId } from "@/lib/plans";
import { AuthField, GenderPicker, type Gender } from "@/components/AuthField";
import { ProgramPicker, usePrograms } from "@/components/Programs";

/* ─── Бүртгэл ───
   ЗАСВАР (2026-08-21): доорх тайлбар "Google товч байхгүй" гэж хэлдэг байсан
   нь ҮНЭН БАЙХАА больсон — Google нэвтрэлт нь маягтын дээр зогсоно. Мөн
   утас, имэйл, хүйс гурав нэмэгдсэн. Хуучин тайлбарыг үлдээвэл дараагийн
   хүн кодыг биш тайлбарыг уншаад буруу дүгнэнэ.

   Имэйлийг
   сервер тал нь username-ээс дотооддоо үүсгэдэг тул User schema дээрх
   email: required + unique-ийг хөндөх шаардлагагүй.
   ?plan=X → бүртгэлийн дараа шууд төлбөр рүү.

   Хэлбэр нь AuthModal-тай ижил: хүрээгүй гадаргуу, дүүргэсэн талбар,
   focus дээр л гарах accent цагираг. */

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const } },
};

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [program, setProgram] = useState("");
  const programs = usePrograms();
  /* Нүүр хуудсан дээр сонгосон хөтөлбөрийг өвлөнө — хүн нэг удаа
     сонгосноо энд дахин хийх шаардлагагүй. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("antaqor:program");
      if (saved) setProgram(saved);
    } catch { /* хаалттай хөтөч */ }
  }, []);

  useEffect(() => {
    trackOnce("signup_view");
    const code = searchParams.get("ref");
    if (code) setReferralCode(code);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const handle = username.trim().replace(/^@+/, "");
    if (!USERNAME_RE.test(handle)) {
      setError("Хэрэглэгчийн нэр 3-30 тэмдэгт, зөвхөн үсэг, тоо, _ агуулна");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Имэйл хаягаа зөв оруулна уу");
      return;
    }
    if (phone.replace(/\D/g, "").length < 6) {
      setError("Утасны дугаараа оруулна уу");
      return;
    }
    if (!gender) {
      setError("Хүйсээ сонгоно уу");
      return;
    }

    setLoading(true);
    track("signup_click");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: handle,
          email: email.trim(),
          phone: phone.trim(),
          password,
          gender,
          ...(program ? { program } : {}),
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Бүртгэл амжилтгүй боллоо");
        setLoading(false);
        return;
      }
      trackOnce("signup_completed");
      const signInRes = await signIn("credentials", { login: handle, password, redirect: false });
      if (signInRes?.error) {
        setError(signInRes.error);
        setLoading(false);
        return;
      }
      const plan = searchParams.get("plan");
      /* ?callbackUrl=/content-agent — Antaqor Agent-ийн туршилтаас ирсэн хүн шууд буцна (зөвхөн дотоод зам) */
      const cb = searchParams.get("callbackUrl") || "";
      router.push(/^\/(?!\/)/.test(cb) ? cb : plan && isPaidPlanId(plan) ? `/pricing?plan=${plan}` : "/onboarding");
      router.refresh();
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-4 py-10">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full max-w-[380px] rounded-[4px] bg-[#141416] p-7 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
      >
        <motion.h1 variants={item} className="text-[24px] font-bold leading-tight text-white">
          Бүртгүүлэх
        </motion.h1>
        <motion.p variants={item} className="mt-1.5 text-[13px] text-[#E2E4E8]">
          Имэйл нь нууц үг сэргээхэд хэрэгтэй
        </motion.p>

        {/* Google нэвтрэлт 2026-09-04-нд ХАСАГДСАН (эзний шийдвэр).
            `GoogleSignInButton` болон `google-idtoken` provider нь
            УСТААГҮЙ — зөвхөн энэ гадаргуугаас салгасан тул буцааж
            залгах нь нэг мөр. */}

        <form onSubmit={handleSubmit} className="space-y-3">
          <motion.div variants={item}>
            <AuthField
              icon="profile"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              placeholder="Хэрэглэгчийн нэр"
            />
          </motion.div>
          <motion.div variants={item}>
            <AuthField
              icon="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="numeric"
              autoComplete="tel"
              placeholder="Утасны дугаар"
            />
          </motion.div>
          <motion.div variants={item}>
            <AuthField
              icon="mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              placeholder="Имэйл"
            />
          </motion.div>
          <motion.div variants={item}>
            <AuthField
              icon="lock"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Нууц үг — дор хаяж 6 тэмдэгт"
            />
          </motion.div>
          <motion.div variants={item}>
            <GenderPicker value={gender} onChange={setGender} />
          </motion.div>

          {/* Хөтөлбөрийн сонголт. ЗААВАЛ биш — бүртгэлийн замд нэмэлт
              хаалт тавихгүй; сонгоогүй хүн дараа нь профайлаасаа
              сонгоно. */}
          <motion.div variants={item}>
            <ProgramPicker value={program} onChange={setProgram} programs={programs} />
          </motion.div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[4px] bg-[#2E29FF]/10 px-4 py-3 text-[13px] leading-snug text-[#FFB4AE]"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            variants={item}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-[4px] bg-[#2E29FF] text-[15px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
          >
            {loading ? "Бүртгэж байна…" : "Бүртгүүлэх"}
          </motion.button>
        </form>

        <motion.p variants={item} className="mt-5 text-center text-[13px] text-[#E2E4E8]">
          Бүртгэлтэй юу?{" "}
          <Link href="/auth/signin" className="font-semibold text-[#2E29FF] transition hover:brightness-110">
            Нэвтрэх
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <SignupInner />
    </Suspense>
  );
}
