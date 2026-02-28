"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const AI_LEVELS = [
  { value: "beginner", label: "Эхлэгч", desc: "AI-тай танилцаж байна" },
  { value: "intermediate", label: "Дунд", desc: "AI хэрэгсэл ашигладаг" },
  { value: "advanced", label: "Ахисан", desc: "AI-р бүтээгдэхүүн бүтээдэг" },
  { value: "expert", label: "Мэргэжилтэн", desc: "AI системийг хөгжүүлдэг" },
];

const INTEREST_OPTIONS = [
  { value: "ai_tools", label: "AI Хэрэгслүүд" },
  { value: "programming", label: "Програмчлал" },
  { value: "design", label: "Дизайн" },
  { value: "business", label: "Бизнес" },
  { value: "data_science", label: "Дата шинжилгээ" },
  { value: "robotics", label: "Робот техник" },
  { value: "content_creation", label: "Контент бүтээх" },
  { value: "education", label: "Боловсрол" },
  { value: "finance", label: "Санхүү" },
  { value: "health", label: "Эрүүл мэнд" },
];

export default function SignUp() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [aiExperience, setAiExperience] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleInterest = (value: string) => {
    setInterests((prev) =>
      prev.includes(value)
        ? prev.filter((i) => i !== value)
        : prev.length < 5
        ? [...prev, value]
        : prev
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          username: username || undefined,
          email,
          phone,
          password,
          age: age ? parseInt(age) : undefined,
          aiExperience,
          interests,
        }),
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
        router.push("/");
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
          <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[2px] text-[#ede8df]">
            Кланд нэгдэх
          </h1>
          <p className="mb-6 text-[11px] tracking-[0.3px] text-[#5a5550]">
            ДИЖИТАЛ ҮНДЭСТНИЙ ГИШҮҮН БОЛ
          </p>

          {/* Progress */}
          <div className="mb-8 flex gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-[2px] flex-1 transition-all ${
                  s <= step ? "bg-[#cc2200]" : "bg-[#1c1c1c]"
                }`}
              />
            ))}
          </div>

          {error && (
            <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Account */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="mb-2 text-[10px] uppercase tracking-[2px] text-[#cc2200]">
                  Бүртгэлийн мэдээлэл
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                    Нэр *
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
                    Хэрэглэгчийн нэр
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                    minLength={3}
                    maxLength={30}
                    className="input-dark"
                    placeholder="username"
                  />
                  <p className="mt-1 text-[10px] text-[#5a5550]">Үсэг, тоо, _ (заавал биш)</p>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                    Имэйл *
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
                    Утасны дугаар
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-dark"
                    placeholder="+976 9999 9999"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                    Нууц үг *
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

                <button
                  type="button"
                  onClick={() => {
                    if (!name || !email || !password || password.length < 6) {
                      setError("Нэр, имэйл, нууц үг (6+ тэмдэгт) бөглөнө үү");
                      return;
                    }
                    setError("");
                    setStep(2);
                  }}
                  className="btn-blood w-full"
                >
                  Үргэлжлүүлэх
                </button>
              </div>
            )}

            {/* Step 2: Personal Info */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="mb-2 text-[10px] uppercase tracking-[2px] text-[#cc2200]">
                  Хувийн мэдээлэл
                </div>

                <div>
                  <label className="mb-2 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                    Нас
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={13}
                    max={120}
                    className="input-dark"
                    placeholder="Таны нас"
                  />
                </div>

                <div>
                  <label className="mb-3 block text-[10px] uppercase tracking-[0.5px] text-[#5a5550]">
                    AI Туршлагын түвшин
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AI_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setAiExperience(level.value)}
                        className={`border p-3 text-left transition ${
                          aiExperience === level.value
                            ? "border-[#cc2200] bg-[rgba(204,34,0,0.08)]"
                            : "border-[#1c1c1c] hover:border-[rgba(240,236,227,0.1)]"
                        }`}
                      >
                        <div className={`text-[11px] font-bold ${aiExperience === level.value ? "text-[#cc2200]" : "text-[#ede8df]"}`}>
                          {level.label}
                        </div>
                        <div className="mt-0.5 text-[9px] text-[#5a5550]">{level.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn-ghost flex-1"
                  >
                    Буцах
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="btn-blood flex-1"
                  >
                    Үргэлжлүүлэх
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Interests */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="mb-2 text-[10px] uppercase tracking-[2px] text-[#cc2200]">
                  Сонирхол (5 хүртэл)
                </div>

                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleInterest(opt.value)}
                      className={`border px-3 py-2 text-[11px] transition ${
                        interests.includes(opt.value)
                          ? "border-[#cc2200] bg-[rgba(204,34,0,0.1)] text-[#cc2200]"
                          : "border-[#1c1c1c] text-[#5a5550] hover:border-[rgba(240,236,227,0.1)] hover:text-[#c8c8c0]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-[#5a5550]">
                  {interests.length}/5 сонгосон
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="btn-ghost flex-1"
                  >
                    Буцах
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-blood flex-1"
                  >
                    {loading ? "Бүртгэл үүсгэж байна..." : "Бүртгүүлэх"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="mt-8 text-center text-[11px] text-[#5a5550]">
            Бүртгэлтэй юу?{" "}
            <Link href="/auth/signin" className="text-[#cc2200] hover:text-[#e8440f]">
              Нэвтрэх
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
