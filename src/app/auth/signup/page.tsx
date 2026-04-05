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
      <div className="w-full max-w-md">
        <div className="card p-8 md:p-10">
          <h1 className="mb-2 text-[28px] font-bold tracking-[1px] text-[#ede8df]">
            Кланд нэгдэх
          </h1>
          <p className="mb-8 text-[11px] tracking-[0.3px] text-[#5a5550]">
            ДИЖИТАЛ ҮНДЭСТНИЙ ГИШҮҮН БОЛ
          </p>

          {error && (
            <div className="mb-6 border-l-2 border-[#FFD300] bg-[rgba(0,100,145,0.08)] px-4 py-3 text-[12px] text-[#FFD300]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Нэр
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="input-dark"
                placeholder="Таны нэр"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Утасны дугаар
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
                required
                maxLength={8}
                className="input-dark"
                placeholder="9911 2233"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Имэйл
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

            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                Нууц үг
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
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-blood w-full"
            >
              {loading ? "Бүртгэж байна..." : "Бүртгүүлэх"}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-[#5a5550]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#FFD300] hover:text-[#B3B300]">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
