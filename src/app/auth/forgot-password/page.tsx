"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card p-8 md:p-10">
          <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">
            Нууц үг сэргээх
          </h1>
          <p className="mb-8 text-[11px] tracking-[0.3px] text-[#5a5550]">
            БҮРТГЭЛТЭЙ ИМЭЙЛ ХАЯГАА ОРУУЛНА УУ
          </p>

          {success ? (
            <div>
              <div className="mb-6 border-l-2 border-green-500 bg-[rgba(34,197,94,0.08)] px-4 py-3 text-[12px] text-green-500">
                <div className="font-medium">Имэйл илгээгдлээ</div>
                <div className="mt-1 text-[11px] text-[rgba(34,197,94,0.7)]">
                  Хэрэв бүртгэлтэй имэйл бол нууц үг сэргээх холбоос илгээгдсэн. Имэйлээ шалгана уу.
                </div>
              </div>
              <Link href="/auth/signin" className="btn-ghost w-full inline-block text-center">
                Нэвтрэх хуудас руу буцах
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
                    Имэйл хаяг
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-dark"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-blood w-full"
                >
                  {loading ? "Илгээж байна..." : "Холбоос илгээх"}
                </button>
              </form>

              <p className="mt-8 text-center text-[11px] text-[#5a5550]">
                Нууц үгээ санаж байна уу?{" "}
                <Link href="/auth/signin" className="text-[#cc2200] hover:text-[#e8440f]">
                  Нэвтрэх
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
