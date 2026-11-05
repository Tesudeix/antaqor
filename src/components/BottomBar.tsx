"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon, { type IconName } from "@/components/Icon";
import { useSession } from "next-auth/react";
import { openAuth } from "@/components/AuthModal";
import CreateSheet from "@/components/CreateSheet";

/* ─── Доод цэс — СИСТЕМИЙН ДАВХАРГА ───────────────────────────────────────
   `Нүүр   Сургалт   +   AI Studio   Профайл`

   Өмнө нь энэ нь дэлгэцийн дунд хөвдөг, ирмэгээс 18px зайтай, гүйлгэхэд
   алга болдог "бүлүүр" байсан. Тэр нь агуулгын ДЭЭР хэвтэж, өөрөө
   агуулга мэт харагддаг — хаана дуусаж, хаанаас эхлэхийг хэлдэггүй.

   Одоо энэ нь системийн давхарга: ирмэгээс ирмэг хүртэл, дээрээ үсэн
   зураастай, бүдгэрүүлсэн дэвсгэртэй, ХЭЗЭЭ Ч далдардаггүй. Хуудсууд
   нь өөрсдөө үүний өндрийг тооцож доод зай авдаг (layout.tsx-ийн
   `--nav-h + --nav-safe + --sp-5`) тул агуулга үүний доор ХЭЗЭЭ Ч
   орохгүй. Хөвөгч самбарын хамгийн том асуудал — сүүлийн мөрийг нь
   халхлах — ингэж бүрмөсөн арилна.

   ТӨВ "+" НЬ ГАНЦ ҮҮСГЭХ ОРЦ. Өмнө нь төв нүд Гишүүнчлэл рүү, "Пост"
   товч толгойн мөрөнд байсан — үүсгэх үйлдэл хоёр өөр газарт хуваагдсан
   ба аль нь ч тод биш байв. Гишүүнчлэл профайл руу шилжсэн (статус бол
   профайлын мэдээлэл), үүсгэх нь энд ганцаараа үлдэв.

   Идэвхтэй төлөв: дүрс тодорна + доор нь 4px улбар цэг. Хүрээ, дүүргэлт,
   шошго байхгүй — тэдгээр нь таван нүдийг таван карт болгодог. */

type Tab = {
  href?: string;
  /** Гадаад холбоос — шинэ цонхонд нээгдэнэ, router ашиглахгүй. */
  external?: boolean;
  onClick?: () => void;
  label: string;
  icon: IconName | React.ReactNode;
  match: (p: string) => boolean;
  /** Төв үүсгэх товч — дүүрэн улбар гадаргуу. */
  create?: boolean;
  /** Нэвтрэлт шаардана — зочин дархад шилжихгүй, нэвтрэх цонх нээнэ. */
  auth?: boolean;
};

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string })?.id || "";
  /* "+" нь ШУУД `/posts/new` руу явдаг байсан — өөрөөр хэлбэл
     Antaqor дээр "үүсгэх" гэдэг нь зураг ХУУЛАХ гэсэн утгатай байв.
     Одоо гурван орцтой хуудас нээнэ: AI зураг, AI видео (удахгүй),
     энгийн пост. Зочны хувьд энэ нь бүртгэлийн цонх хэвээр. */
  const [createOpen, setCreateOpen] = useState(false);

  const tabs: Tab[] = useMemo(() => {
    const base: Tab[] = [
      /* 2026-10-26 (эзний хүсэлт): эхний нүд хүн бүрт НҮҮР. 2026-10-11-ээс
         гишүүнд энд дотоод /chat байсан; чат одоо Telegram групп руу гардаг
         тусдаа нүд (доор). Дотоод /chat хажуугийн цэс, профайлд хэвээр. */
      {
        href: "/",
        label: "Нүүр",
        icon: "home" as IconName,
        match: (p: string) => p === "/" || p.startsWith("/feed") || p.startsWith("/posts/"),
      },
      {
        href: "/classroom",
        label: "Сургалт",
        icon: "skills" as IconName,
        match: (p: string) => p.startsWith("/classroom") || p.startsWith("/calendar"),
        auth: true,
      },
      {
        onClick: () => setCreateOpen(true),
        label: "Үүсгэх",
        icon: "plus" as IconName,
        create: true,
        match: (p: string) => p.startsWith("/posts/new") || p.startsWith("/tools/nano-banano"),
        auth: true,
      },
      /* ЧАТ → ПРОМПТ (2026-09-04). Чатын таб нь хүнийг сайтаас ГАДАГШ,
         Threads руу гаргадаг байв — доод цэсний таван нүдний нэгийг
         гарах хаалганд өгөх нь үнэтэй. Промптын сан нь эсрэгээрээ:
         дотогшоо, өдөр бүр шинэчлэгддэг, хэрэгсэл рүү шууд холбогддог.
         Бүлгийн чат нь хажуугийн цэс болон хөлөнд хэвээр байна.

         2026-09-21: энэ нүдийг БУЦААВ. Хооронд нь Agent түүний байрыг
         эзэлсэн бөгөөд Agent-ыг устгахад нүд нь хамт алга болж, зөвхөн
         дээрх тайлбар өнчин үлдсэн байв — доод цэс дөрөв болж хумигдсан.

         `auth` ТАВЬСАНГҮЙ: промптын сан зочинд ч нээлттэй (хажуугийн
         цэс мөн адил зочинд үзүүлдэг). Түгжээтэй промпт бүр өөрөө
         "гишүүн бол" гэж хэлнэ — орохоос нь өмнө хаах шаардлагагүй. */
      /* 2026-10-13: Промпт цэснээс хасагдав → AI видео. 2026-10-26: AI видео ч
         antaqor.com-оос хасагдав (эзний хүсэлт) — цэс дахин 5 нүд, "+" төвдөө. */
      /* "Хэрэгсэл" нүд 2026-10-06-нд эзний хүсэлтээр бүрмөсөн хасагдав —
         доод цэс дахин 5 нүдтэй, "+" төвдөө. */
      /* 2026-10-26: AI Studio (= /content-agent) — зочинд танилцуулга, гишүүнд AI зураг/ихэр.
         `auth` үгүй: тэр хуудас өөрөө нэвтрэх/багцын сонголтоо харуулна. */
      {
        href: "/content-agent",
        label: "AI Studio",
        icon: "spark" as IconName,
        match: (p: string) => p.startsWith("/content-agent"),
      },
      /* 2026-10-27: Чат (Telegram) нүд мобайл доод цэснээс хасагдав (эзний хүсэлт). */
      {
        href: myId ? `/profile/${myId}` : "/profile",
        label: "Профайл",
        icon: session?.user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : ("profile" as IconName),
        match: (p: string) => p.startsWith("/profile") || p.startsWith("/pricing"),
        auth: true,
      },
    ];

    if (session) return base;

    /* Зочны хувьд ХЭЛБЭР нь хэвээр, зөвхөн үйлдэл нь өөр: нэвтрэлт
       шаардсан нүд шилжихийн оронд цонх нээнэ — уншиж байсан хуудсаа
       алдахгүй. Төв "+" нь зочинд бүртгэлийн цонх нээнэ: тэр бол яг л
       "юм бүтээе" гэсэн хүсэлт, зөвхөн эхний алхам нь өөр. */
    return base.map((t) =>
      t.auth
        ? { ...t, href: undefined, onClick: () => openAuth(t.create ? "signup" : "signin") }
        : t
    );
  }, [session, myId]);

  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/erchis")) return null;
  /* /rent өөрийн доод цэстэй — хоёр мөр дээр дээрээс нь давхарлахгүй. */
  if (pathname.startsWith("/rent")) return null;
  if (pathname.startsWith("/khuushuur")) return null; /* хуушуур меню өөрийн дээд мөр + сагстай */
  if (pathname.startsWith("/shop")) return null; /* дэлгүүр өөрийн дээд мөр + сагстай */
  if (pathname.startsWith("/founders")) return null;
  if (pathname.startsWith("/yuki")) return <YukiBottomBar pathname={pathname} />;

  return (
    <>
      {/* Хуудасны төгсгөлд суудаг зай — цэсний ЯГ өндөр + аюулгүй бүс +
          24px амьсгал. Энэ нь `fixed` цэс агуулгын сүүлийн мөрийг (мөн
          хөлийг) халхлахаас сэргийлнэ. Хуудас бүр дээр тусад нь `pb-…`
          бичих оролдлого нь нэгийг нь мартах эрсдэлтэй — энд нэг л удаа,
          цэсний хажууд, цэс байхгүй үед автоматаар алга болно. */}
      <div
        aria-hidden
        className="md:hidden"
        style={{ height: "calc(var(--nav-h) + var(--nav-safe) + var(--sp-5))" }}
      />
      <nav
        aria-label="Үндсэн цэс"
        className="app-chrome-dock fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur-xl md:hidden"
        style={{
          height: "calc(var(--nav-h) + var(--nav-safe))",
          paddingBottom: "var(--nav-safe)",
          background: "var(--chrome-bg, rgba(10,10,10,0.92))",
          borderColor: "var(--chrome-line, #E3E6EE)",
        }}
      >
        <div className="mx-auto flex h-[var(--nav-h)] max-w-[520px] items-stretch">
          {tabs.map((tab) => {
            const active = tab.match(pathname);
            const glyph =
              typeof tab.icon === "string" ? <Icon name={tab.icon as IconName} size={24} /> : tab.icon;

            const inner = tab.create ? (
              /* Ганц дүүрэн улбар гадаргуу. Улбар өнгө ховор байх тусам
                 хүчтэй — тиймээс энэ мөрөнд түүнийг эзэмших эрхтэй нэг л
                 зүйл байна, тэр нь үүсгэх үйлдэл. */
              <span className="flex h-10 w-11 items-center justify-center rounded-[4px] bg-[#2E29FF] text-white">
                <Icon name="plus" size={24} />
              </span>
            ) : (
              /* Дүрс ба цэг нь НЭГ багана болж хамтдаа голлоно (цэгийг
                 absolute-аар доогуур нь өлгөвөл 64px нүдний ёроолд наалдаж,
                 таслагдсан мэт харагдана). 24 + 6 + 4 = 34px, дээр доор нь
                 15px тэнцүү зайтай. */
              <span className="flex flex-col items-center justify-center gap-1.5">
                <span
                  className={`t-fast flex h-6 w-6 items-center justify-center transition-colors ${
                    active ? "text-[var(--nav-fg-strong)]" : "text-[#E2E4E8]"
                  }`}
                >
                  {glyph}
                </span>
                {/* Идэвхтэйн цорын ганц тэмдэг — 4px цэг. Дүүргэлт биш
                    учир нь дүүргэлт нь нүдийг карт болгож, таван карт
                    зэрэгцвэл аль нь идэвхтэйг дахин хайх хэрэгтэй болно. */}
                <span
                  className={`h-1 w-1 rounded-full transition-opacity duration-150 ${
                    active ? "bg-[#2E29FF] opacity-100" : "opacity-0"
                  }`}
                />
              </span>
            );

            const cell = "press flex flex-1 items-center justify-center";

              /* Гадаад холбоосыг Next-ийн `Link`-ээр дамжуулбал клиент
               router нь дотоод замыг эрэлхийлж 404 өгнө. Энгийн `<a>`. */
            if (tab.external && tab.href) {
              return (
                <a
                  key={tab.label}
                  href={tab.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tab.label}
                  className={cell}
                >
                  {inner}
                </a>
              );
            }

          if (tab.onClick) {
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={tab.onClick}
                  aria-label={tab.label}
                  className={cell}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={tab.label}
                href={tab.href!}
                aria-label={tab.label}
                aria-current={active ? "page" : undefined}
                className={cell}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/* ─── Гүйлгэх үед далдлах — ЗӨВХӨН Yuki ──────────────────────────────────
   Yuki бол тусдаа бүтээгдэхүүн, өөрийн хэлбэртэй: тэнд доод цэс хөвөгч
   бүлүүр хэвээр тул гүйлгэхэд замаас зайлах ёстой. Antaqor-ийн цэс энэ
   зан төлөвийг АВАХГҮЙ — тэр нь системийн давхарга болсон, системийн
   давхарга ирж очиж байвал систем биш. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    last.current = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const dy = y - last.current;
        if (Math.abs(dy) < 16) return;
        if (y < 80) setHidden(false);
        else setHidden(dy > 0);
        last.current = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return hidden;
}

function YukiBottomBar({ pathname }: { pathname: string }) {
  const PINK = "#2E29FF";
  const hidden = useHideOnScroll();
  const tabs: { href: string; label: string; icon: IconName; accent?: boolean; match: (p: string) => boolean }[] = [
    { href: "/yuki", label: "Нүүр", icon: "home", match: (p) => p === "/yuki" },
    { href: "/yuki/book", label: "Цаг захиалах", icon: "calendar", accent: true, match: (p) => p.startsWith("/yuki/book") },
    { href: "/yuki/me", label: "Миний", icon: "profile", match: (p) => p.startsWith("/yuki/me") },
  ];

  return (
    <nav
      aria-label="Yuki цэс"
      className={`fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] transition-all duration-300 ease-out md:hidden ${
        hidden ? "pointer-events-none translate-y-[140%] opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="flex w-full max-w-[300px] items-center justify-between gap-1 rounded-[4px] bg-white/95 px-2.5 py-2 shadow-[0_10px_30px_-6px_rgba(190,24,93,0.28)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 items-center justify-center"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-[4px] transition-colors duration-150"
                style={tab.accent ? { background: PINK, color: "#fff" } : { color: active ? PINK : "#94889A" }}
              >
                <Icon name={tab.icon} size={20} />
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
