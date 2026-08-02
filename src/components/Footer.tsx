"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ─── Footer — мокапын HUD хэв маяг: брэнд · mono линкүүд · сериал зурвас. ───
// Нүүр ба зочны курс өөрсдийн HudFooterStrip-тэй тул тэнд нуугдана; social
// линкүүд /api/social-links (админ)-аас ирнэ. Mobile-д BottomBar байгаа тул md+.

const SOCIALS: { label: string; href: string; svg: React.ReactNode }[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/tesudei",
    svg: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/antaqor",
    svg: <path d="M15 8.5h-2a1.5 1.5 0 00-1.5 1.5v2H15l-.5 3h-3V21M9 12h2.5" />,
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@antaqor",
    svg: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="3" />
        <path d="M10.5 9.3v5.4l4.6-2.7-4.6-2.7z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    label: "Threads",
    href: "https://www.threads.net/@tesudei",
    svg: (
      <path d="M16.5 11.6c-.2-2.9-1.8-4.6-4.4-4.7-1.6 0-2.9.7-3.7 2M12 21c-3.3 0-5.4-1.1-6.7-3-1.2-1.7-1.8-4-1.8-6s.6-4.3 1.8-6C6.6 4.1 8.7 3 12 3s5.4 1.1 6.7 3c.6.9 1.1 1.9 1.3 3M11.6 17c-1.4.1-2.6-.5-2.7-1.7-.1-1.1 1-1.9 2.5-2 2.6-.1 4.2 1.1 4.2 3.1 0 1.8-1.4 3.2-3.6 3.4" />
    ),
  },
];

// Label -> icon: админ линкүүд танил icon-оо авна; үл мэдэх label -> сум.
const ICON_BY_LABEL = new Map(SOCIALS.map((s) => [s.label.toLowerCase(), s.svg]));
const ARROW_ICON = <path d="M7 17L17 7M9 7h8v8" />;

const LINKS: { label: string; href: string }[] = [
  { label: "НҮҮР", href: "/" },
  { label: "КУРС", href: "/classroom" },
  { label: "PROMPT", href: "/prompts" },
  { label: "PLAN", href: "/pricing" },
];

export default function Footer() {
  const pathname = usePathname();
  const [socials, setSocials] = useState(SOCIALS);
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch("/api/social-links")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.links) && d.links.length > 0) {
          setSocials(
            d.links.map((l: { label: string; href: string }) => ({
              label: l.label,
              href: l.href,
              svg: ICON_BY_LABEL.get(l.label.toLowerCase()) || ARROW_ICON,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Такеовер бүсүүд өөрсдийн chrome-той
  if (pathname.startsWith("/yuki") || pathname.startsWith("/erchis") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="border-t border-[#2E2E33] bg-[#0E0E10] pb-24 md:pb-0">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-8">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <span className="block h-3 w-3 bg-[#1080CA]" />
            <span
              className="text-[12px] font-extrabold tracking-[0.08em] text-[#FFFFFF]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ANTAQOR<span className="text-[#1080CA]">///</span>
            </span>
          </Link>

          {/* Mono nav */}
          <nav className="chrome flex flex-wrap gap-7 text-[10px] font-bold">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[#B4B4BA] transition-colors hover:text-[#1080CA]">
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Socials — admin-driven */}
          <div className="flex items-center gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                className="flex h-10 w-10 items-center justify-center border border-[#2E2E33] text-[#84848C] transition-colors hover:border-[#1080CA] hover:text-[#1080CA]"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {s.svg}
                </svg>
              </a>
            ))}
          </div>
        </div>

        {/* HUD baseline */}
        <div className="chrome mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#2E2E33] pt-6 text-[9px] text-[#5C5C64]">
          <span>© {year} ANTAQOR · БҮХ ЭРХ ХУУЛИАР ХАМГААЛАГДСАН</span>
          <div className="flex items-center gap-6">
            <a href="/policy.html" className="transition-colors hover:text-[#B4B4BA]">
              НУУЦЛАЛ
            </a>
            <a href="/terms.html" className="transition-colors hover:text-[#B4B4BA]">
              НӨХЦӨЛ
            </a>
            <span>47.92°N 106.92°E</span>
            <span className="tracking-[0.3em]">░▒▓█</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
