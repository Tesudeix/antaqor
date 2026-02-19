"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;
    const check = async () => {
      try {
        const res = await fetch("/api/notifications?limit=1");
        const data = await res.json();
        if (res.ok) setUnread(data.unreadCount);
      } catch {
        // silent
      }
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, [session]);

  if (!session) return null;

  const links = [
    {
      href: "/",
      label: "Feed",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: "/classroom",
      label: "Learn",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      href: "/posts/new",
      label: "Post",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      accent: true,
    },
    {
      href: "/members",
      label: "Members",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      href: `/profile/${(session?.user as { id?: string })?.id || ""}`,
      label: "Me",
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      badge: unread > 0,
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#1c1c1c] bg-[rgba(3,3,3,0.95)] backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around px-2 py-1">
        {links.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 transition ${
                link.accent
                  ? "text-[#cc2200]"
                  : active
                  ? "text-[#ede8df]"
                  : "text-[#5a5550]"
              }`}
            >
              {link.accent ? (
                <div className="flex h-8 w-8 items-center justify-center bg-[#cc2200] text-[#ede8df]">
                  {link.icon}
                </div>
              ) : (
                link.icon
              )}
              <span className="text-[8px] uppercase tracking-[1px]">{link.label}</span>
              {link.badge && (
                <span className="absolute right-1 top-1 h-2 w-2 bg-[#cc2200]" />
              )}
              {active && !link.accent && (
                <span className="absolute -top-[1px] left-1/2 h-[2px] w-4 -translate-x-1/2 bg-[#cc2200]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
