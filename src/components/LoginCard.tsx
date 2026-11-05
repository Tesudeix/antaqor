"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AuthField } from "@/components/AuthField";
import SocialAuthRow from "@/components/SocialAuthRow";

/* Нэвтрэх хуудасны карт — /auth/signin болон чатын гарсан төлөв.
   Сайтын үндсэн нэвтрэлт нь AuthModal (цонх); энэ нь шууд хаягаар орж
   ирсэн, эсвэл нууц үг сэргээсний дараах хүнд зориулсан ижил маягт.
   Хоёулаа ЯГ нэг хэлээр ярих ёстой — хүрээгүй гадаргуу, дүүргэсэн
   талбар, focus дээр л гарах accent цагираг. */

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function LoginCard({
  next = "/",
  onSuccess,
  heading = "Нэвтрэх",
  subtitle = "Хэрэглэгчийн нэр, нууц үгээрээ үргэлжлүүл",
}: {
  next?: string;
  onSuccess?: () => void;
  heading?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      // Урд талын "@" нь хүмүүсийн зуршил — сервер рүү явахаас нь өмнө авна.
      const handle = login.trim().replace(/^@+/, "");
      const res = await signIn("credentials", { login: handle, password, redirect: false });
      if (res?.error) {
        if (res.status === 429 || res.error === "fetch failed") {
          setError("Хэт олон оролдлого. 1 минутын дараа дахин оролдоно уу.");
          setCooldown(60);
        } else {
          setError(res.error);
        }
      } else if (onSuccess) {
        onSuccess();
      } else {
        router.push(next);
        router.refresh();
      }
    } catch {
      setError("Хэт олон оролдлого. 1 минутын дараа дахин оролдоно уу.");
      setCooldown(60);
    } finally {
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
          {heading}
        </motion.h1>
        <motion.p variants={item} className="mt-1.5 text-[13px] text-[#E2E4E8]">
          {subtitle}
        </motion.p>


        <form onSubmit={handleSubmit} className="space-y-3">
          <motion.div variants={item}>
            <AuthField
              icon="profile"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              placeholder="Хэрэглэгчийн нэр"
            />
          </motion.div>
          <motion.div variants={item}>
            <AuthField
              icon="lock"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Нууц үг"
            />
          </motion.div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[4px] bg-[#2E29FF]/10 px-4 py-3 text-[13px] leading-snug text-[#FFB4AE]"
            >
              {error}
              {cooldown > 0 && (
                <span className="ml-2 text-[#E2E4E8]">
                  ({Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")})
                </span>
              )}
            </motion.p>
          )}

          <motion.button
            variants={item}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading || cooldown > 0}
            className="h-12 w-full rounded-[4px] bg-[#2E29FF] text-[15px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
          >
            {loading ? "Нэвтэрч байна…" : cooldown > 0 ? `Түр хүлээ (${cooldown}с)` : "Нэвтрэх"}
          </motion.button>
        </form>

        {/* AuthModal-тай ЯГ ижил байрлал — нэг хүн хоёр гадаргууг хоёр өөр
            газраас олох ёсгүй. */}
        <motion.div variants={item}>
          <SocialAuthRow next={next} onSuccess={onSuccess} />
        </motion.div>

        {/* Нэвтрэхийн яг доор бүртгүүлэх. router.push ашигласан шалтгаан:
            AuthModal нь /auth/signup руу заасан <a>-г барьж аваад цонх
            нээдэг — аль хэдийн нэвтрэх маягт дээр байгаа хүнд дахиад цонх
            давхарлах нь илүүц. */}
        <motion.button
          variants={item}
          whileTap={{ scale: 0.985 }}
          type="button"
          onClick={() => router.push(next && next !== "/" ? `/auth/signup?callbackUrl=${encodeURIComponent(next)}` : "/auth/signup")}
          className="mt-3 h-12 w-full rounded-[4px] bg-[#141414] text-[15px] font-semibold text-white transition hover:bg-[#1E1E1E]"
        >
          Бүртгүүлэх
        </motion.button>

        <motion.div variants={item} className="mt-5 text-center">
          <Link href="/auth/forgot-password" className="text-[13px] text-[#E2E4E8] transition hover:text-white">
            Нууц үгээ мартсан уу?
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
