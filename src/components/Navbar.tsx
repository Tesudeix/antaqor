"use client";

import Link from "next/link";
import Icon from "@/components/Icon";
import { openAuth } from "@/components/AuthModal";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import CreditPill from "./CreditPill";

/* ─── Дээд мөр — ГУРВАН зүйл, өөр юу ч биш ─────────────────────────────
   `ANTAQOR   🔔  аватар`

   Өмнө нь энд зэрэг зогсож байсан зүйлс: цэсний зургаан таб, кредитийн
   чип, PLAN товч, "Пост" товч, LIVE суудлын тоолуур, мэдэгдэл, аватар.
   Найман өөр зүйл, гурван өөр өнгийн онцлол — үүнээс алийг нь эхэлж
   харах ёстойг дэлгэц өөрөө хэлж чадахгүй болсон.

   Одоо дүрэм нь энгийн: дээд мөр бол ХААНА БАЙГААГ (тэмдэг) ба ХЭН
   БАЙГААГ (аватар) хэлнэ, дээр нь юу тохиолдсоныг (хонх). Хаашаа явахыг
   доод цэс, юу үүсгэхийг доод цэсний төв "+" хариуцна. Нэг мөр = нэг үүрэг.

   Гишүүнчлэл ХААШАА ЯВСАН БЭ: аватарын цаана, профайл дотор. Байнга
   харагдаж байсан PLAN товч нь худалдан авалт хийсэн хүнд ч, хийхгүй
   хүнд ч адилхан хашгирдаг байсан — статус бол профайлын мэдээлэл,
   толгойн мөрний зар биш.

   Ширээний дэлгэцэд энэ мөр БАЙХГҮЙ (lg:hidden) — тэнд SideNav барина. */

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [hidden, setHidden] = useState(false);

  // Суулгасан PWA дотор л гүйлгэхэд далдлана. Хөтчийн таб дотор үргэлж
  // харагдана — тэнд хаягийн мөр аль хэдийн орон зай иддэг.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      nav.standalone === true ||
      document.referrer.startsWith("android-app://");
    if (!isStandalone) return;

    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (dy > 4 && y > 80) setHidden(true);
        else if (dy < -4) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─── Yuki/Erchis takeover — тэр хэсгүүд өөрсдийн бүрэн хүрээтэй ───
  // (hook-уудын дараа шалгана — hook-ийн дараалал зам болгонд тогтвортой)
  if (pathname.startsWith("/yuki")) return null;
  if (pathname.startsWith("/erchis")) return null;
  if (pathname.startsWith("/rent")) return null;
  if (pathname.startsWith("/shop")) return null;
  if (pathname.startsWith("/khuushuur")) return null;
  /* AI Studio (/content-agent) өөрийн гар утасны толгойтой — хоёр толгой давхарлахгүй (2026-10-26). */
  if (pathname.startsWith("/content-agent")) return null;

  const myId = (session?.user as { id?: string })?.id || "";
  const profileHref = myId ? `/profile/${myId}` : "/profile";

  return (
    <nav
      className="app-chrome-top sticky top-0 z-50 border-b lg:hidden"
      style={{
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.2s ease",
        willChange: "transform",
        background: "var(--chrome-bg, rgba(10,10,10,0.88))",
        borderColor: "var(--chrome-line, #E3E6EE)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Өндөр 64px = --nav-h. GuestHero нь `calc(100svh - 65px)` гэж
          тооцдог (64 + 1px зураас) тул энэ тоог өөрчилвөл тэндээ давхар
          өөрчил, эс бөгөөс слайдер дэлгэцээс хальж, доор нь хоосон зай
          гарна. */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8 lg:px-12">
        <Link href="/" aria-label="Antaqor" className="press flex items-center gap-2">
          <span className="block h-3.5 w-3.5 bg-[#2E29FF]" />
          <span
            className={`text-[13px] font-extrabold tracking-[0.08em] text-[var(--nav-fg-strong)] ${session ? "max-[400px]:hidden" : ""}`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            ANTAQOR
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {session ? (
            <>
              {/* Кредит нь энэ сайтын ЦОРЫН ГАНЦ хэрэглээний хэмжүүр —
                  зураг, видео, агент бүгд түүгээр явна. Дээд мөрөнд
                  байхгүй үед хүн үлдэгдлээ мэдэхийн тулд тусдаа хуудас
                  руу орох шаардлагатай болдог. */}
              {/* Гишүүнчлэлийн үлдсэн хоног + кредит — хоёулаа CreditPill дотор. */}
              <CreditPill />
              {/* Мэдэгдлийн хонх 2026-10-06-нд хасагдав (эзний хүсэлт). */}
              {/* Аватар нь профайлын орц БӨГӨӨД гишүүнчлэл, тохиргоо,
                  дэлгэцийн горим бүгд түүний цаана байна. */}
              <Link
                href={profileHref}
                aria-label="Профайл"
                className="press ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#1E1E1E] text-[12px] font-bold text-[#2E29FF]"
              >
                {session.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user?.name || ""}
                    className="h-9 w-9 object-cover"
                  />
                ) : (
                  session.user?.name?.charAt(0).toUpperCase() || "U"
                )}
              </Link>
            </>
          ) : (
            /* Зочинд НЭГ үндсэн үйлдэл (Бүртгүүл) + нэг чимээгүй гарц
               (Нэвтрэх). LIVE суудлын тоолуур энэ мөрнөөс хасагдсан —
               тэр нь нүүрний өөрийн нотолгооны зурваст байх ёстой
               мэдээлэл болохоос, цэсний хэсэг биш. */
            <>
              <button
                type="button"
                onClick={() => openAuth("signin")}
                className="press hidden px-3 py-2 text-[14px] font-semibold text-[#FCEE0A] transition hover:opacity-80 sm:inline-block"
              >
                Нэвтрэх
              </button>
              <button
                type="button"
                onClick={() => openAuth("signup")}
                className="press inline-flex h-10 items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-5 text-[14px] font-semibold text-white transition hover:bg-[#1F1AD9]"
              >
                Бүртгүүл
                <Icon name="arrow" size={16} />
              </button>
            </>
          )}
        </div>
      </div>

    </nav>
  );
}
