"use client";

import { useEffect, useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { track, trackOnce } from "@/lib/analytics";
import { isPaidPlanId } from "@/lib/plans";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// ─── Бүртгэл — Edgerunner card, LoginCard-тай ижил хэл. ───
// Google эхэндээ (нэг товшилт) → эсвэл 3 талбар. ?plan=X → шууд төлбөр.

function SignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    trackOnce("signup_view");
    const code = searchParams.get("ref");
    if (code) setReferralCode(code);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    track("signup_click");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
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
      const signInRes = await signIn("credentials", { login: email.trim(), password, redirect: false });
      if (signInRes?.error) {
        setError(signInRes.error);
        setLoading(false);
        return;
      }
      const plan = searchParams.get("plan");
      router.push(plan && isPaidPlanId(plan) ? `/pricing?plan=${plan}` : "/onboarding");
      router.refresh();
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-[4px] border bg-[#0a0a0c] px-3 py-3 text-[14px] outline-none transition focus:border-[#1080CA]";
  const inputStyle = { borderColor: "rgba(255,255,255,0.12)", color: "#FFFFFF" } as const;
  const labelCls = "mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.04em]";

  return (
    <div className="flex min-h-[78vh] items-center justify-center px-0 sm:px-4">
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
        className="relative w-full sm:max-w-[400px]"
      >
        <div className="relative border-y border-[rgba(255,255,255,0.12)] bg-[#0d0d10] p-6 max-sm:border-x-0 sm:rounded-[4px] sm:border sm:p-8">
          {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c, i) => (
            <span key={i} className={`pointer-events-none absolute h-3 w-3 border-[#1080CA] ${c}`} />
          ))}

          <span className="tag">ANTAQOR /// БҮРТГЭЛ</span>
          <h1 className="mt-4 text-[26px] font-bold" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
            Нэгдэх
          </h1>
          <p className="mt-1 mb-6 text-[12px]" style={{ color: "#84848C" }}>
            30 секунд · карт шаардлагагүй
          </p>

          {/* Хамгийн хурдан зам — Google нэг товшилт. ?plan байвал шууд төлбөр рүү. */}
          <GoogleSignInButton
            next={(() => {
              const p = searchParams.get("plan");
              return p && isPaidPlanId(p) ? `/pricing?plan=${p}` : "/onboarding";
            })()}
          />

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
            <span className="chrome text-[9px] font-bold text-[#84848C]">ЭСВЭЛ</span>
            <span className="h-px flex-1 bg-[rgba(255,255,255,0.12)]" />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-[4px] border px-4 py-3 text-[12px]"
              style={{ borderColor: "rgba(16,128,202,0.4)", background: "rgba(16,128,202,0.08)", color: "#FFFFFF" }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls} style={{ color: "#84848C" }}>Нэр</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                autoComplete="name"
                placeholder="Таны нэр"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: "#84848C" }}>Имэйл</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@mail.com"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: "#84848C" }}>Нууц үг</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Дор хаяж 6 тэмдэгт"
                className={inputCls}
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-[4px] border border-[#1080CA] bg-[#1080CA] text-[14px] font-bold uppercase tracking-[0.01em] text-[#0E0E10] transition hover:bg-[#4FA8E8] active:translate-y-[1px] disabled:opacity-50"
            >
              {loading ? "Бүртгэж байна..." : "Нэгдэх >"}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px]" style={{ color: "#84848C" }}>
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="font-bold text-[#1080CA] transition hover:brightness-110">
              Нэвтрэх
            </Link>
          </p>
        </div>
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
