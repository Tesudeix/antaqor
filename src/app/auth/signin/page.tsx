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
      <div className="w-full max-w-md">
        <div className="card p-8 md:p-10">
          <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">
            Нэвтрэх
          </h1>
          <p className="mb-8 text-[11px] tracking-[0.3px] text-[#5a5550]">
            ДИЖИТАЛ ҮНДЭСТЭНД НЭВТРЭХ
          </p>

          {error && (
            <div className={`mb-6 border-l-2 px-4 py-3 text-[12px] ${
              cooldown > 0
                ? "border-[#cc2200] bg-[rgba(204,34,0,0.12)] text-[#cc2200]"
                : "border-[#cc2200] bg-[rgba(204,34,0,0.08)] text-[#cc2200]"
            }`}>
              <div>{error}</div>
              {cooldown > 0 && (
                <div className="mt-2 text-[11px] text-[rgba(204,34,0,0.7)]">
                  {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")} хүлээнэ үү
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Имэйл эсвэл хэрэглэгчийн нэр
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="input-dark"
                placeholder="you@example.com эсвэл username"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                  Нууц үг
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-[10px] text-[#cc2200] hover:text-[#e8440f] transition"
                >
                  Мартсан уу?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-dark"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="btn-blood w-full"
            >
              {loading ? "Нэвтэрж байна..." : cooldown > 0 ? `Түр хүлээнэ үү (${cooldown}с)` : "Нэвтрэх"}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-[#5a5550]">
            Бүртгэлгүй юу?{" "}
            <Link href="/auth/signup" className="text-[#cc2200] hover:text-[#e8440f]">
              Кланд нэгдэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
