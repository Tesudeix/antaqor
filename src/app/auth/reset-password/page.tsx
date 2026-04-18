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

  if (!ready) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#FFFF01]" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="mb-4 text-[14px] text-[#A3A3A3]">
          Холбоос хүчингүй байна
        </p>
        <Link
          href="/auth/forgot-password"
          className="inline-block rounded-[4px] bg-[#FFFF01] px-6 py-2.5 text-[13px] font-bold text-[#0A0A0A] transition hover:brightness-110"
        >
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
      <h1 className="mb-1 text-[22px] font-bold text-[#FAFAFA]">
        Шинэ нууц үг
      </h1>
      <p className="mb-6 text-[12px] text-[#6B6B6B]">
        Шинэ нууц үгээ оруулна уу
      </p>

      {success ? (
        <div>
          <div className="mb-5 rounded-[4px] bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] px-4 py-3 text-[12px] text-green-400">
            <p className="font-medium">Нууц үг амжилттай солигдлоо</p>
            <p className="mt-1 text-[11px] text-green-400/60">
              Шинэ нууц үгээрээ нэвтэрнэ үү.
            </p>
          </div>
          <Link
            href="/auth/signin"
            className="block w-full rounded-[4px] bg-[#FFFF01] py-2.5 text-center text-[13px] font-bold text-[#0A0A0A] transition hover:brightness-110"
          >
            Нэвтрэх
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-5 rounded-[4px] bg-[rgba(255,255,1,0.06)] border border-[rgba(255,255,1,0.15)] px-4 py-3 text-[12px] text-[#FFFF01]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Шинэ нууц үг
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FAFAFA] outline-none transition focus:border-[rgba(255,255,1,0.4)] placeholder:text-[#6B6B6B]"
                placeholder="6+ тэмдэгт"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Нууц үг давтах
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FAFAFA] outline-none transition focus:border-[rgba(255,255,1,0.4)] placeholder:text-[#6B6B6B]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[4px] bg-[#FFFF01] py-2.5 text-[13px] font-bold text-[#0A0A0A] transition hover:brightness-110 disabled:opacity-50"
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
      <div className="w-full max-w-[400px]">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-8">
          <Suspense fallback={<div className="flex justify-center py-8"><div className="h-3 w-3 animate-pulse rounded-full bg-[#FFFF01]" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
