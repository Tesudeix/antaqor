"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Icon from "@/components/Icon";
import { AuthField, GenderPicker, type Gender } from "@/components/AuthField";
import SocialAuthRow from "@/components/SocialAuthRow";

/* ─── Нэвтрэх / Бүртгүүлэх — харилцах цонх ────────────────────────────────
   Сайтын НЭГ Л жинхэнэ нэвтрэх гадаргуу. Товч дарахад хуудас солигдож,
   уншиж байсан зүйл нь алга болох ёсгүй — дээр нь давхарлаж гарна.

   openAuth() нь цонхны үйл явдал илгээнэ. Ингэснээр аль ч компонент context,
   provider, props дамжуулалгүйгээр цонхыг нээж чадна.

   ─ Хэлбэрийн зарчим (2026-08-17-ны цэвэрлэгээ) ─
   Хүрээ байхгүй. Ялгаа нь гадаргуу + сүүдрээр гарна: цонх бол бараан
   дэвсгэр дээр өргөгдсөн хавтгай, түүний доторх талбарууд нэг шат
   living гүнзгий. Зурсан шугам нь ЗӨВХӨН төлөв дамжуулах үедээ л
   зөвтгөгдөнө — тиймээс focus дээр л accent цагираг гарна.

   Шошго байхгүй: "Хэрэглэгчийн нэр" гэсэн шошгын доор "Хэрэглэгчийн нэр"
   гэсэн placeholder тавих нь нэг үгийг хоёр удаа бичсэн хэрэг. Хоёрхон
   талбартай маягтад юу хаана байгаа нь эргэлзээгүй.

   Таб байхгүй: дээр нь segmented control, доор нь "Бүртгэлтэй юу?" холбоос
   гэсэн ХОЁР сэлгэгч байсан — хоёулаа яг нэг ажил хийдэг. Доод мөр үлдсэн,
   учир нь тэр нь контексттэй (юу хийж байгааг чинь хэлж байгаад санал
   болгож байна), segmented control нь зүгээр л чимэг. */

type Mode = "signin" | "signup";
const EVT = "antaqor:auth";

export function openAuth(mode: Mode = "signin") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT, { detail: { mode } }));
  }
}

export default function AuthModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [afterAuth, setAfterAuth] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const firstField = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      opener.current = document.activeElement;
      setAfterAuth(null);
      setMode(((e as CustomEvent).detail?.mode as Mode) || "signin");
      setError("");
      setOpen(true);
    };
    window.addEventListener(EVT, onOpen);
    return () => window.removeEventListener(EVT, onOpen);
  }, []);

  /* ── Бүх /auth/* холбоосыг барьж авна ───────────────────────────────────
     46 файл /auth/signin, /auth/signup руу холбоос тавьсан байсан. Тэдгээрийг
     нэг бүрчлэн засахын оронд энд нэг л сонсогч тавьсан: auth хуудас руу
     явах холбоос дарагдвал цонх нээгээд, шилжилтийг зогсооно.

     Ctrl/Cmd/Shift дарж эсвэл target="_blank" бол саад болохгүй — хүн шинэ
     таб нээхийг хүсвэл түүнийг нь булааж авах ёсгүй. Хуудсууд өөрсдөө байсаар
     байгаа тул шууд хаяг бичиж орох, нууц үг сэргээх ажиллана. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (a.getAttribute("target") === "_blank") return;
      const path = href.split("?")[0];
      if (path !== "/auth/signin" && path !== "/auth/signup") return;
      e.preventDefault();
      opener.current = a;
      const plan = new URL(href, window.location.origin).searchParams.get("plan");
      setAfterAuth(plan && ["starter", "builder", "operator", "founding"].includes(plan) ? `/pricing?plan=${plan}` : null);
      setMode(path === "/auth/signup" ? "signup" : "signin");
      setError("");
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    /* Фокусыг нээсэн товч руу нь буцаана — гарнаас ажилладаг хүн замаа
       алдахгүй. */
    if (opener.current instanceof HTMLElement) opener.current.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    /* Гарах үед ЗААВАЛ буцааж тавина — цонх хаагдсан хэрнээ гүйлгэлт
       түгжээтэй үлдвэл хуудас хөшсөн мэт санагдана. */
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => firstField.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      clearTimeout(t);
    };
  }, [open, close]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    /* Урд талын "@" нь хүмүүсийн зуршил — сервер рүү явахаас нь өмнө авна. */
    const handle = login.trim().replace(/^@+/, "");

    if (mode === "signup") {
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(handle)) {
        setError("Хэрэглэгчийн нэр 3-30 тэмдэгт, зөвхөн үсэг, тоо, _ агуулна");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError("Имэйл хаягаа зөв оруулна уу");
        return;
      }
      if (phone.replace(/\D/g, "").length < 6) {
        setError("Утасны дугаараа оруулна уу");
        return;
      }
      /* Цонх нь хүйсийг шаардана, API нь шаардахгүй. Санаатай зөрүү:
         сервер талд заавал болговол хүйсийн талбаргүй хуучин клиент бүрийн
         бүртгэл 400 болно (api/auth/signup дахь тайлбарыг үз). */
      if (!gender) {
        setError("Хүйсээ сонгоно уу");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: handle, email: email.trim(), phone: phone.trim(), password, gender }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Бүртгэл амжилтгүй боллоо");
      }
      const r = await signIn("credentials", { login: handle, password, redirect: false });
      if (r?.error) throw new Error("Нэвтрэх нэр эсвэл нууц үг буруу байна");
      close();
      if (afterAuth) router.push(afterAuth);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  }

  /* Хаалттай үед DOM-д юу ч үлдээхгүй. Өмнө нь AnimatePresence-ээр
     гаргах хөдөлгөөн хийж байсан нь хаасны дараа `fixed inset-0 z-200`
     давхаргыг ил тод хэвээр DOM дээр орхиж, сайт даяар дарахад саад
     болж байсан. Гарах хөдөлгөөн нь тийм эрсдэлийг үнэ цэнэгүй. */
  if (!open) return null;

  const isUp = mode === "signup";

  return (
    <>
      {open && (
        <motion.div
          key="auth-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          /* Утсан дээр ч, дэлгэц дээр ч голдоо. Өмнө нь items-end байсан тул
             жижиг дэлгэц дээр доод ирмэгээс наалдсан хуудас шиг гардаг байв. */
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={isUp ? "Бүртгүүлэх" : "Нэвтрэх"}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[380px] rounded-[4px] bg-[#141416] p-7 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[24px] font-bold leading-tight text-white">
                  {isUp ? "Бүртгүүлэх" : "Нэвтрэх"}
                </h2>
                <p className="mt-1.5 text-[13px] text-[#E2E4E8]">
                  {isUp ? "Имэйл нь нууц үг сэргээхэд хэрэгтэй" : "Хэрэглэгчийн нэр, нууц үгээрээ үргэлжлүүл"}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Хаах"
                className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] text-[#E2E4E8] transition hover:bg-[#141414] hover:text-white"
              >
                <Icon name="cancel" size={20} />
              </button>
            </div>


            <form onSubmit={submit} className="space-y-3">
              <AuthField
                ref={firstField}
                icon="profile"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Хэрэглэгчийн нэр"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
              />
              {isUp && (
                <>
                  <AuthField
                    icon="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Утасны дугаар"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                  />
                  <AuthField
                    icon="mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Имэйл"
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="email"
                    required
                  />
                </>
              )}
              <AuthField
                icon="lock"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Нууц үг"
                autoComplete={isUp ? "new-password" : "current-password"}
                required
              />
              {isUp && <GenderPicker value={gender} onChange={setGender} />}

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[4px] bg-[#2E29FF]/10 px-4 py-3 text-[13px] leading-snug text-[#FFB4AE]"
                >
                  {error}
                </motion.p>
              )}

              <motion.button
                whileTap={{ scale: 0.985 }}
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-[4px] bg-[#2E29FF] text-[15px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-50"
              >
                {loading ? "Түр хүлээнэ үү…" : isUp ? "Бүртгүүлэх" : "Нэвтрэх"}
              </motion.button>
            </form>

            {/* Брэндийн товчнууд маягтын ДООР: нууц үгээр орох нь энэ сайтын
                үндсэн зам хэвээр, эдгээр нь товчлол. Дээр нь тавивал хамгийн
                олон хүний хэрэглэдэг замыг доор шахсан хэрэг болно. */}
            <SocialAuthRow
              next={afterAuth || "/"}
              onSuccess={() => {
                close();
                if (afterAuth) router.push(afterAuth);
                router.refresh();
              }}
            />

            {!isUp && (
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(""); }}
                className="mt-5 block w-full text-center text-[13px] text-[#E2E4E8] transition hover:text-white"
              >
                Бүртгэлгүй юу? <span className="font-semibold text-[#2E29FF]">Бүртгүүлэх</span>
              </button>
            )}
            {isUp && (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="mt-5 block w-full text-center text-[13px] text-[#E2E4E8] transition hover:text-white"
              >
                Бүртгэлтэй юу? <span className="font-semibold text-[#2E29FF]">Нэвтрэх</span>
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
