"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !phone || !email || !password || password.length < 6) {
      setError("Бүх талбарыг бөглөнө үү (нууц үг 6+ тэмдэгт)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      const signInRes = await signIn("credentials", {
        login: email,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setError(signInRes.error);
      } else {
        router.push("/clan");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-[400px]">
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-8">
          <h1 className="mb-1 text-[22px] font-bold text-[#FAFAFA]">
            Бүртгүүлэх
          </h1>
          <p className="mb-6 text-[12px] text-[#6B6B6B]">
            Antaqor-д нэгдэх
          </p>

          {error && (
            <div className="mb-5 rounded-[4px] bg-[rgba(255,255,1,0.06)] border border-[rgba(255,255,1,0.15)] px-4 py-3 text-[12px] text-[#FFFF01]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Нэр
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FAFAFA] outline-none transition focus:border-[rgba(255,255,1,0.4)] placeholder:text-[#6B6B6B]"
                placeholder="Таны нэр"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Утас
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                required
                maxLength={8}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FAFAFA] outline-none transition focus:border-[rgba(255,255,1,0.4)] placeholder:text-[#6B6B6B]"
                placeholder="9911 2233"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Имэйл
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#FAFAFA] outline-none transition focus:border-[rgba(255,255,1,0.4)] placeholder:text-[#6B6B6B]"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[#A3A3A3]">
                Нууц үг
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[4px] bg-[#FFFF01] py-2.5 text-[13px] font-bold text-[#0A0A0A] transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#6B6B6B]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#FFFF01] transition hover:brightness-110">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
