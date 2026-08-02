"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PasskeySignIn from "@/components/PasskeySignIn";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Single source of truth for the sign-in UI. Used by /auth/signin AND the
// chat logged-out state. Edgerunner card — same shell as signup. Login accepts
// a USERNAME (or email).
export default function LoginCard({
  next = "/",
  onSuccess,
  heading = "Нэвтрэх",
  subtitle = "Хэрэглэгчийн нэр эсвэл имэйлээрээ нэвтэрнэ үү",
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
      const res = await signIn("credentials", { login: login.trim(), password, redirect: false });
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

  const inputCls =
    "w-full rounded-[4px] border bg-[#0a0a0c] px-3 py-3 text-[14px] outline-none transition focus:border-[#1080CA]";
  const inputStyle = { borderColor: "rgba(255,255,255,0.12)", color: "#FFFFFF" } as const;
  const labelCls = "font-mono text-[10px] font-bold uppercase tracking-[0.04em]";

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

          <span className="tag">ANTAQOR /// ACCESS</span>
          <h1 className="mt-4 text-[26px] font-bold" style={{ color: "#1080CA", fontFamily: "var(--font-display)" }}>
            {heading}
          </h1>
          <p className="mt-1 mb-6 text-[12px]" style={{ color: "#84848C" }}>{subtitle}</p>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 rounded-[4px] border px-4 py-3 text-[12px]"
              style={{ borderColor: "rgba(16,128,202,0.4)", background: "rgba(16,128,202,0.08)", color: "#FFFFFF" }}
            >
              {error}
              {cooldown > 0 && (
                <span className="ml-2 text-[11px]" style={{ color: "#84848C" }}>
                  ({Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")})
                </span>
              )}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`${labelCls} mb-1.5 block`} style={{ color: "#84848C" }}>
                Хэрэглэгчийн нэр / имэйл
              </label>
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className={inputCls}
                style={inputStyle}
                placeholder="@username"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className={labelCls} style={{ color: "#84848C" }}>Нууц үг</label>
                <Link href="/auth/forgot-password" className="text-[11px] text-[#1080CA] transition hover:brightness-110">
                  Мартсан?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={inputCls}
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="h-12 w-full rounded-[4px] border border-[#1080CA] bg-[#1080CA] text-[14px] font-bold uppercase tracking-[0.01em] text-[#0E0E10] transition hover:bg-[#4FA8E8] active:translate-y-[1px] disabled:opacity-50"
            >
              {loading ? "Нэвтэрч байна..." : cooldown > 0 ? `Түр хүлээ (${cooldown}с)` : "Нэвтрэх >"}
            </button>
          </form>

          <PasskeySignIn />

          <GoogleSignInButton next={next} />

          <p className="mt-6 text-center text-[12px]" style={{ color: "#84848C" }}>
            Бүртгэлгүй юу?{" "}
            <Link href="/auth/signup" className="font-bold text-[#1080CA] transition hover:brightness-110">
              Нэгдэх
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
