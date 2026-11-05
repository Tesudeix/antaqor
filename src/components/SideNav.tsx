"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Icon, { type IconName } from "@/components/Icon";
import { openAuth } from "@/components/AuthModal";
import { AI_IMAGE_ENABLED } from "@/lib/flags";
import { isAdminEmail } from "@/lib/adminClient";

/* ─── Ширээний зүүн цэс ───────────────────────────────────────────────────
   Дэлгэц дээр дээд header-ийн оронд энэ зогсоно (lg дээшээ). Утсан дээр энэ
   нь харагдахгүй — тэнд Navbar + доод цэс хэвээр.

   Яагаад хажуугийн цэс вэ: header-т 6 линк хэвтээгээр багтахын тулд 10px
   том үсэг болж багасдаг байсан. Босоо жагсаалтад 15px-ээр, дүрэгтэйгээ
   тавтай багтана — мөн доод цэсэнд багтахгүй байсан бүх зам (Сургалт,
   Промпт, Чат) ширээний дэлгэцэд бүрэн харагдана.

   Хэлбэр нь сайтын хэлээрээ: хүрээгүй, гадаргуугаар ялгасан, идэвхтэй
   мөр нь accent, радиус 4px. */

/** `external` — гадаад холбоос. `next/link` нь дотоод замыг эрэлхийлж
 *  404 өгдөг тул эдгээрийг энгийн `<a>`-ээр, шинэ цонхонд нээнэ. */
type Item = {
  href: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
  external?: boolean;
  /** Мөрийн ард жижиг тоо (кредитийн үлдэгдэл) */
  badge?: string;
  low?: boolean;
};

export default function SideNav() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Сесс өөрөө id-г авч явдаг — Navbar-тай ижил эх сурвалж, нэмэлт дуудлагагүй.
  const myId = (session?.user as { id?: string } | undefined)?.id || "";
  /* Доод дансны чип (2026-10-11, X маяг): нэр + @handle + ⋯ → Гарах. */
  const [me, setMe] = useState<{ name: string; username?: string; avatar?: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const chip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!myId) { setMe(null); return; }
    let alive = true;
    fetch(`/api/users/${myId}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d?.user) setMe(d.user); }).catch(() => {});
    return () => { alive = false; };
  }, [myId]);
  /* Кредитийн үлдэгдэл (2026-10-26) — ширээний цэсэнд үргэлж харагдана: 1024–1279px-д
     баруун багана (CreditPill) байхгүй тул өмнө нь үлдэгдэл, «авах» зам огт харагддаггүй байв. */
  const [credit, setCredit] = useState<{ balance: number; admin: boolean } | null>(null);
  const adminAcct = isAdminEmail(session?.user?.email);
  useEffect(() => {
    if (!myId) { setCredit(null); return; }
    const load = () => fetch("/api/credits").then((r) => r.json()).then((d) => { if (typeof d?.balance === "number") setCredit({ balance: d.balance, admin: adminAcct }); }).catch(() => {});
    load();
    window.addEventListener("antaqor:credits", load);
    return () => window.removeEventListener("antaqor:credits", load);
  }, [myId, adminAcct]);
  useEffect(() => {
    if (!menu) return;
    const off = (e: MouseEvent) => { if (chip.current && !chip.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [menu]);

  // Админ хэсэг өөрийн бүрэн дэлгэцийн бүтэцтэй; тэнд хажуугийн цэс саад.
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/yuki") ||
    pathname.startsWith("/erchis")
  ) {
    return null;
  }

  const profileHref = myId ? `/profile/${myId}` : "/profile";

  /* Дараалал нь доод цэстэй ЯГ адил: Нүүр → Сургалт → Хамтлаг → Профайл.
     Ширээний дэлгэц илүү өргөн тул хоёр нэмэлт зам (Промпт, Чат) багтана,
     гэхдээ шинэ зүйл биш — доод цэс дээр Хамтлагийн доор байгаа зүйлс.

     ГИШҮҮНЧЛЭЛ ЭНД БАЙХГҮЙ (гишүүний хувьд). Тэр нь цэсийн зүйл биш,
     дансны төлөв — профайл дотор, төлөвийн зурвас хэлбэрээр амьдарна.
     Зочны хувьд өөр: тэдэнд профайл гэж байхгүй тул үнийн хуудас нь
     цэсэнд харагдах ёстой. */
  const items: Item[] = session
    ? [
        { href: "/", label: "Нүүр", icon: "home", match: (p) => p === "/" || p.startsWith("/feed") || p.startsWith("/posts") },
        { href: "/classroom", label: "Сургалт", icon: "skills", match: (p) => p.startsWith("/classroom") || p.startsWith("/calendar") },
        /* AI Studio = Antaqor Agent (2026-10-26, эзний хүсэлт): гишүүнд AI зураг + AI ихэр, бизнест бүх боломж. */
        { href: "/content-agent", label: "AI Studio", icon: "spark", match: (p) => p.startsWith("/content-agent") },
        /* КРЕДИТ (2026-10-26) — 1 кр = 1₮; AI Studio-ийн зураг/видео үүгээр. Үлдэгдэл нь ард нь. */
        { href: "/credits/buy", label: "Кредит", icon: "star", match: (p) => p.startsWith("/credits"), badge: credit ? (credit.admin ? "∞" : credit.balance.toLocaleString("en-US")) : undefined, low: !!credit && !credit.admin && credit.balance < 500 },
        /* ЧАТ — апп ДОТОРХ шууд мессеж. Өмнө нь энэ товч Threads дээрх
           бүлгийн чат руу, өөрөөр хэлбэл сайтаас ГАДАГШ аваачдаг байв:
           гишүүн яриагаа өөр платформ дээр үлдээгээд эргэж ирдэггүй, ярианы
           түүх нь Antaqor-т ҮЛДДЭГГҮЙ, шинэ гишүүн юу ярьсныг хойд өдөр нь
           хайж олдоггүй. Одоо админ руу шууд бичих ба гишүүд хоорондоо
           бичих хоёр зам нэг дороо, сайт дотроо байна. */
        /* Чат 2026-11-02-нд бүрэн хасагдав (эзний хүсэлт) — /chat нь нүүр рүү шилждэг (middleware). */
        /* AI видео 2026-10-13 нэмэгдээд 2026-10-26-нд хасагдав (эзний хүсэлт) — AI зураг/ихэр /content-agent-д. */
        /* Промпт, Magazine, Үйлчилгээ — цэснээс хасав (2026-10-13, эзний хүсэлт). Хуудаснууд URL-аар хэвээр. */
        /* Хүрээлэл цэснээс ТҮР хасагдсан (2026-10-06, эзний хүсэлтээр). /circles хуудас хэвээр — буцаахдаа энэ мөрийг сэргээ. */
        /* ХЭРЭГСЭЛ. `match` нь ЯГ энэ замаар — доорх "AI зураг" нь
           `/tools`-оор бүхэлд нь тааруулдаг тул өргөн бичвэл хоёулаа
           зэрэг идэвхтэй харагдана. */
        /* "Хэрэгсэл" цэс 2026-10-06-нд хасагдав (эзний хүсэлт). */
        /* AI зураг — Nano Banana 2 студи. Кредитээр ажиллана; кредитийн
           хуудас /credits нь энэ замын дотор (студийн толгойд) байгаа. */
        /* AI зураг ТҮР хаалттай — `AI_IMAGE_ENABLED` (src/lib/flags.ts).
           Мөрийг устгаагүй: тугийг `true` болгоход яг энэ байрандаа буцаж
           ирнэ, дараалал нь ч хөдлөхгүй. */
        ...(AI_IMAGE_ENABLED
          ? ([{ href: "/tools/nano-banano", label: "AI зураг", icon: "image", match: (p: string) => p.startsWith("/tools/nano-banano") || p.startsWith("/credits") }] as Item[])
          : []),
        { href: "/leaderboard", label: "Тэргүүлэгчид", icon: "chart", match: (p) => p.startsWith("/leaderboard") },
        { href: profileHref, label: "Профайл", icon: "profile", match: (p) => p.startsWith("/profile") || p.startsWith("/pricing") },
      ]
    : [
        { href: "/", label: "Нүүр", icon: "home", match: (p) => p === "/" },
        { href: "/classroom", label: "Сургалт", icon: "skills", match: (p) => p.startsWith("/classroom") },
        { href: "/content-agent", label: "AI Studio", icon: "spark", match: (p) => p.startsWith("/content-agent") },
        /* AI видео 2026-10-13 нэмэгдээд 2026-10-26-нд хасагдав (эзний хүсэлт) — AI зураг/ихэр /content-agent-д. */
        /* Промпт, Magazine, Үйлчилгээ — цэснээс хасав (2026-10-13, эзний хүсэлт). Хуудаснууд URL-аар хэвээр. */
        /* Хүрээлэл цэснээс ТҮР хасагдсан (2026-10-06, эзний хүсэлтээр). /circles хуудас хэвээр — буцаахдаа энэ мөрийг сэргээ. */
        { href: "/leaderboard", label: "Тэргүүлэгчид", icon: "chart", match: (p) => p.startsWith("/leaderboard") },
        { href: "/pricing", label: "Гишүүнчлэл", icon: "ticket", match: (p) => p.startsWith("/pricing") },
      ];

  return (
    <aside className="scrollbar-hide sticky top-0 hidden h-screen w-[275px] shrink-0 flex-col overflow-y-auto px-3 py-3 lg:flex">
      {/* Ширээний дэлгэцэд дээд header байхгүй — тэмдэг нь цэсийн эхлэлийг
          заана. Дэлгэцийн горим профайлын дансны хэсэгт байна. */}
      {/* ЗАСВАР: энд кредит + хонх зэрэг тавьсан нь ДАВХАРДАЛ үүсгэсэн —
          `PageShell` нь ширээний БАРУУН баганын хамгийн дээр хонхыг аль
          хэдийн тавьдаг байсан тул хоёр хонх зэрэг харагдаж байв. Хоёулаа
          баруун талдаа очив (`PageShell`); зүүн багана нь ЗӨВХӨН зам
          заана. Нэг үүрэг — нэг байрлал. */}
      <div className="mb-5 flex items-center justify-between gap-2 px-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          {/* 2026-10-18: улаан дөрвөлжин placeholder → сайтын жинхэнэ тэмдэг (PWA icon) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon-192.png" alt="" width={28} height={28} className="block h-7 w-7 shrink-0 rounded-[4px]" />
          <span className="truncate text-[19px] font-extrabold tracking-[0.06em] text-[var(--nav-fg-strong)]">
            ANTAQOR
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = it.match(pathname);
          /* 2026-10-11: X маягийн том мөр — 26px дүрс, 20px бичиг, идэвхтэй нь ТОД. */
          const cls = `press flex w-fit items-center gap-5 rounded-[4px] py-3 pl-3 pr-6 text-[20px] transition-colors ${
            active
              ? "bg-[var(--nav-hover-bg)] font-extrabold text-[var(--nav-fg-strong)]"
              : "font-medium text-[var(--nav-fg-strong)] hover:bg-[var(--nav-hover-bg)]"
          }`;

          if (it.external) {
            return (
              <a
                key={it.href + it.label}
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                <Icon name={it.icon} size={24} />
                {it.label}
              </a>
            );
          }

          return (
            <Link key={it.href + it.label} href={it.href} className={cls}>
              <Icon name={it.icon} size={24} />
              {it.label}
              {it.badge && (
                <span
                  className="-ml-2 rounded-full px-2 py-0.5 text-[13px] font-bold tabular-nums"
                  style={it.low ? { background: "#FEF3C7", color: "#92400E" } : { background: "rgba(46,41,255,0.10)", color: "#2E29FF" }}
                >
                  {it.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col gap-2">
        {session ? (
          <>
            <Link
              href="/posts/new"
              onClick={(e) => { if (window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); window.dispatchEvent(new CustomEvent("antaqor:create")); } }}
              className="press flex h-[54px] items-center justify-center rounded-[4px] bg-[#2E29FF] text-[17px] font-extrabold text-[#0A0A0A] transition hover:bg-[#1F1AD9]"
            >
              Нийтлэх
            </Link>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuth("signup")}
              className="press h-[54px] rounded-[4px] bg-[#2E29FF] text-[17px] font-extrabold text-[#0A0A0A] transition hover:bg-[#1F1AD9]"
            >
              Бүртгүүлэх
            </button>
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="press h-[54px] rounded-[4px] text-[17px] font-bold transition border border-[#FCEE0A]/60 bg-transparent text-[#FCEE0A] hover:bg-[rgba(252,238,10,0.12)]"
            >
              Нэвтрэх
            </button>
          </>
        )}
      </div>

      <div className="mt-auto" />

      {session && (
        <div ref={chip} className="relative mt-6">
          {menu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-[4px] border border-[color:var(--t-line,rgba(255,255,255,0.12))] bg-[#141414] py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]" role="menu">
              <Link href={profileHref} onClick={() => setMenu(false)} role="menuitem" className="block px-4 py-3 text-[15px] font-bold text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.05)]">
                Профайл
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}
                className="block w-full px-4 py-3 text-left text-[15px] font-bold text-[#F2F2F4] hover:bg-[rgba(255,255,255,0.05)]"
              >
                Гарах {me?.username ? `@${me.username}` : ""}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menu}
            className="press flex w-full items-center gap-3 rounded-[4px] p-3 text-left transition hover:bg-[var(--nav-hover-bg)]"
          >
            {me?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={me.avatar} alt="" className="h-11 w-11 shrink-0 rounded-[4px] object-cover" />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-[#2E29FF] text-[15px] font-extrabold text-[#0A0A0A]">
                {(me?.name || session.user?.name || "?").slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[15px] font-extrabold text-[var(--nav-fg-strong)]">{me?.name || session.user?.name}</span>
              {me?.username && <span className="block truncate text-[14px] text-[#9C9CA6]">@{me.username}</span>}
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-[var(--nav-fg-strong)]" aria-hidden>
              <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>
      )}
    </aside>
  );
}
