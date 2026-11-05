"use client";

import Icon, { BrandIcon, type BrandName } from "@/components/Icon";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

/* ─── Footer — ЗӨВХӨН сошиал ──────────────────────────────────────────────
   Брэндийн блок, тайлбар, хоёр нэрлэсэн багана (Хүрээлэл / Antaqor), ©
   мөр — бүгд хасагдсан. Үлдсэн нь дөрвөн дүрс.

   Линкүүд өөрсдөө устаагүй: Гишүүнчлэл, Сургалт, Тэргүүлэгчид нь доод цэс
   болон navbar дээр байна. Харин Нууцлал/Нөхцөл (`/policy.html`,
   `/terms.html`) нь ОДОО сайтын ямар ч цэсээс хүрэхгүй боллоо — файлууд
   байгаа, шууд хаягаар нь л орно. Хэрэв app store эсвэл төлбөрийн
   үйлчилгээнд шаардлагатай бол хаа нэгтээ буцааж холбох хэрэгтэй.

   Сошиал линкүүд /api/social-links (админ)-аас ирнэ; DB хоосон бол доорх
   өгөгдмөл дөрөв. */

const SOCIALS: { label: string; href: string; brand: BrandName }[] = [
  { label: "Instagram", href: "https://www.instagram.com/tesudei", brand: "instagram" },
  { label: "Facebook", href: "https://www.facebook.com/antaqor", brand: "facebook" },
  { label: "YouTube", href: "https://www.youtube.com/@antaqor", brand: "youtube" },
  { label: "Threads", href: "https://www.threads.net/@tesudei", brand: "threads" },
];

// Админ линкүүд танил brand mark-аа авна; үл мэдэх label -> холбоосын icon.
const BRAND_BY_LABEL = new Map(SOCIALS.map((s) => [s.label.toLowerCase(), s.brand]));

export default function Footer() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [socials, setSocials] = useState<{ label: string; href: string; brand: BrandName | null }[]>(
    SOCIALS.map((x) => ({ ...x }))
  );

  useEffect(() => {
    if (pathname === "/") return;
    fetch("/api/social-links")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.links) && d.links.length > 0) {
          setSocials(
            d.links.map((l: { label: string; href: string }) => ({
              label: l.label,
              href: l.href,
              brand: BRAND_BY_LABEL.get(l.label.toLowerCase()) || null,
            }))
          );
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Такеовер бүсүүд өөрсдийн chrome-той
  if (pathname === "/" || pathname.startsWith("/yuki") || pathname.startsWith("/erchis") || pathname.startsWith("/rent") || pathname.startsWith("/shop") || pathname.startsWith("/khuushuur") || pathname.startsWith("/admin") || pathname.startsWith("/content-agent")) {
    return null;
  }

  const showJoin = status !== "loading" && !session;

  return (
    <footer className="bg-[#0A0A0A] pb-[calc(env(safe-area-inset-bottom)+84px)] md:pb-0">
      {showJoin && (
        <div className="border-b border-[#141414] px-4 py-8 text-center md:px-8 md:py-10">
          <p className="text-[clamp(22px,3.6vw,30px)] font-extrabold leading-[1.15] tracking-[-0.025em] text-[#FFFFFF]">
            Хүрээлэлд нэгд
          </p>
          <p className="mx-auto mt-2.5 max-w-[42ch] text-[14px] leading-[1.6] text-[#E2E4E8]">
            Гишүүнчлэлээ сонгоод AI entrepreneur-уудын хаалттай орчинд ор.
          </p>
          <Link
            href="/pricing"
            className="mt-5 inline-flex h-13 items-center gap-2.5 bg-[#2E29FF] px-8 text-[15px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            Нэгдэх
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 md:px-8 md:py-5 lg:px-12">
        <nav className="flex items-center gap-5 text-[12px] font-semibold text-[#E2E4E8]">
          <Link href="/pricing" className="transition hover:text-[#F2F2F4]">Гишүүнчлэл</Link>
          <Link href="/classroom" className="transition hover:text-[#F2F2F4]">Сургалт</Link>
        </nav>
        <div className="flex items-center justify-center gap-1.5">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.label}
            className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#141414] text-[#E2E4E8] transition-colors hover:bg-[#1E1E1E] hover:text-[#2E29FF]"
          >
            {s.brand ? <BrandIcon name={s.brand} size={16} /> : <Icon name="external" size={16} />}
          </a>
        ))}
        </div>
      </div>
    </footer>
  );
}
