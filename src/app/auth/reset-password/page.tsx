"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  // Wait for client hydration before checking token
  if (!ready) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-3 w-3 animate-pulse bg-[#cc2200]" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center">
        <div className="mb-4 font-[Bebas_Neue] text-2xl tracking-[1px] text-[rgba(240,236,227,0.3)]">
          Холбоос хүчингүй байна
        </div>
        <Link href="/auth/forgot-password" className="btn-blood inline-block">
          Дахин хүсэлт илгээх
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Нууц үг таарахгүй байна");
      return;
    }

    if (password.length < 6) {
      setError("Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Алдаа гарлаа. Дахин оролдоно уу.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">
        Шинэ нууц үг
      </h1>
      <p className="mb-8 text-[11px] tracking-[0.3px] text-[#5a5550]">
        ШИНЭ НУУЦ ҮГ ТОХИРУУЛАХ
      </p>

      {success ? (
        <div>
          <div className="mb-6 border-l-2 border-green-500 bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[12px] text-green-500">
            <div className="font-medium">Нууц үг амжилттай солигдлоо</div>
            <div className="mt-1 text-[11px] text-[rgba(34,197,94,0.7)]">
              Шинэ нууц үгээрээ нэвтэрнэ үү.
            </div>
          </div>
          <Link href="/auth/signin" className="btn-blood w-full inline-block text-center">
            Нэвтрэх
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Шинэ нууц үг
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="input-dark"
                placeholder="••••••••"
              />
              <p className="mt-1 text-[10px] text-[#5a5550]">Хамгийн багадаа 6 тэмдэгт</p>
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Нууц үг давтах
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="input-dark"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-blood w-full"
            >
              {loading ? "Хадгалж байна..." : "Нууц үг солих"}
            </button>
          </form>
        </>
      )}
    </>
  );
}

export default function ResetPassword() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card p-8 md:p-10">
          <Suspense fallback={<div className="flex justify-center py-8"><div className="h-3 w-3 animate-pulse bg-[#cc2200]" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
