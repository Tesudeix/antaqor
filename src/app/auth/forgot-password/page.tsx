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
      <div className="w-full max-w-[400px]">
        <div className="rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black p-8">
          <h1 className="mb-1 text-[22px] font-bold text-[#0e1726]">
            Нууц үг сэргээх
          </h1>
          <p className="mb-6 text-[12px] text-[#E2E4E8]">
            Хэрэглэгчийн нэр эсвэл имэйлээ оруулна уу
          </p>

          {success ? (
            <div>
              <div className="mb-5 rounded-[4px] bg-[rgba(46,41,255,0.08)] border border-[rgba(46,41,255,0.2)] px-4 py-3 text-[12px] text-green-400">
                <p className="font-medium">Имэйл илгээгдлээ</p>
                <p className="mt-1 text-[11px] text-green-400/60">
                  Имэйлээ шалгаад нууц үг сэргээх холбоос дээр дарна уу.
                </p>
              </div>
              <Link
                href="/auth/signin"
                className="block w-full rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-transparent py-2.5 text-center text-[13px] font-medium text-[#E2E4E8] transition hover:text-[#0e1726] hover:border-[rgba(15,23,38,0.20)]"
              >
                Нэвтрэх хуудас руу буцах
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 rounded-[4px] bg-[rgba(46,41,255,0.06)] border border-[rgba(46,41,255,0.15)] px-4 py-3 text-[12px] text-[#2E29FF]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[12px] font-medium text-[#E2E4E8]">
                    Хэрэглэгчийн нэр эсвэл имэйл
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black px-3 py-2.5 text-[13px] text-[#0e1726] outline-none transition focus:border-[rgba(46,41,255,0.4)] placeholder:text-[#E2E4E8]"
                    placeholder="username эсвэл you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-[4px] bg-[#2E29FF] py-2.5 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? "Илгээж байна..." : "Холбоос илгээх"}
                </button>
              </form>

              <p className="mt-6 text-center text-[12px] text-[#E2E4E8]">
                Нууц үгээ санаж байна уу?{" "}
                <Link href="/auth/signin" className="text-[#2E29FF] transition hover:brightness-110">
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
