"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SignIn() {
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
      const res = await signIn("credentials", {
        login,
        password,
        redirect: false,
      });

      if (res?.error) {
        if (res.status === 429 || res.error === "fetch failed") {
          setError("Хэт олон оролдлого. 1 минутын дараа дахин оролдоно уу.");
          setCooldown(60);
        } else {
          setError(res.error);
        }
      } else {
        router.push("/");
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[400px]">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-8">
          <h1 className="mb-1 text-[22px] font-bold text-[#E8E8E8]">
            Нэвтрэх
          </h1>
          <p className="mb-6 text-[12px] text-[#999999]">
            Бүртгэлтэй хаягаараа нэвтэрнэ үү
          </p>

          {error && (
            <div className="mb-5 rounded-[4px] bg-[rgba(239,44,88,0.06)] border border-[rgba(239,44,88,0.15)] px-4 py-3 text-[12px] text-[#EF2C58]">
              {error}
              {cooldown > 0 && (
                <span className="ml-2 text-[11px] text-[#999999]">
                  ({Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")})
                </span>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#999999]">
                Имэйл эсвэл хэрэглэгчийн нэр
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#999999]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[12px] font-medium text-[#999999]">
                  Нууц үг
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-[11px] text-[#EF2C58] transition hover:brightness-110"
                >
                  Мартсан?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[rgba(239,44,88,0.4)] placeholder:text-[#999999]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="w-full rounded-[4px] bg-[#EF2C58] py-2.5 text-[13px] font-bold text-[#F8F8F6] transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Нэвтэрж байна..." : cooldown > 0 ? `Түр хүлээнэ үү (${cooldown}с)` : "Нэвтрэх"}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#999999]">
            Бүртгэлгүй юу?{" "}
            <Link href="/auth/signup" className="text-[#EF2C58] transition hover:brightness-110">
              Бүртгүүлэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
