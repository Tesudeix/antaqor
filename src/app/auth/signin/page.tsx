"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        router.push("/");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="card p-8 md:p-10">
          <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[4px] text-[#ede8df]">
            Нэвтрэх
          </h1>
          <p className="mb-8 text-[11px] tracking-[2px] text-[#5a5550]">
            ДИЖИТАЛ ҮНДЭСТЭНД НЭВТРЭХ
          </p>

          {error && (
            <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogle}
            className="btn-ghost mb-6 flex w-full items-center justify-center gap-3 !tracking-[2px]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#c8c8c0" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#c8c8c0" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#5a5550" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#5a5550" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google-ээр нэвтрэх
          </button>

          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#1c1c1c]" />
            <span className="text-[10px] tracking-[3px] text-[#5a5550]">ЭСВЭЛ</span>
            <div className="h-px flex-1 bg-[#1c1c1c]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] uppercase tracking-[3px] text-[#5a5550]">
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
              <label className="mb-2 block text-[10px] uppercase tracking-[3px] text-[#5a5550]">
                Нууц үг
              </label>
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
              disabled={loading}
              className="btn-blood w-full"
            >
              {loading ? "Нэвтэрж байна..." : "Нэвтрэх"}
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
