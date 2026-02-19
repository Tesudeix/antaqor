"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(240,236,227,0.08)] bg-[rgba(3,3,3,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="font-[Bebas_Neue] text-2xl tracking-[4px] text-[#ede8df]">
          ANTA<span className="text-[#cc2200]">QOR</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0] transition hover:text-[#ede8df]">
            Feed
          </Link>
          <Link href="/classroom" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0] transition hover:text-[#ede8df]">
            Classroom
          </Link>
          <Link href="/members" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0] transition hover:text-[#ede8df]">
            Members
          </Link>
          <Link href="/clan" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0] transition hover:text-[#ede8df]">
            Clan
          </Link>
          {session ? (
            <>
              <Link href="/posts/new" className="btn-blood !py-2 !px-5 !text-[10px]">
                New Post
              </Link>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id: string }).id}`}
                className="flex h-9 w-9 items-center justify-center border border-[rgba(240,236,227,0.15)] text-[11px] font-bold text-[#c8c8c0] transition hover:border-[#cc2200] hover:text-[#ede8df]"
              >
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </Link>
              <button
                onClick={() => signOut()}
                className="text-[11px] uppercase tracking-[3px] text-[#5a5550] transition hover:text-[#cc2200]"
              >
                Exit
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0] transition hover:text-[#ede8df]">
                Sign In
              </Link>
              <Link href="/auth/signup" className="btn-blood !py-2 !px-5 !text-[10px]">
                Join
              </Link>
            </>
          )}
        </div>

        {/* Mobile: notification bell + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          {session && <NotificationBell />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6 text-[#c8c8c0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[rgba(240,236,227,0.06)] bg-[#0f0f0f] px-6 py-5 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Feed
            </Link>
            <Link href="/classroom" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Classroom
            </Link>
            <Link href="/members" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Members
            </Link>
            <Link href="/clan" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Clan
            </Link>
            {session ? (
              <>
                <Link href="/posts/new" className="text-[11px] uppercase tracking-[3px] text-[#cc2200]" onClick={() => setMenuOpen(false)}>
                  New Post
                </Link>
                <Link href={`/profile/${(session.user as { id: string }).id}`} className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button onClick={() => { signOut(); setMenuOpen(false); }} className="text-left text-[11px] uppercase tracking-[3px] text-[#5a5550]">
                  Exit
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-[11px] uppercase tracking-[3px] text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
                <Link href="/auth/signup" className="text-[11px] uppercase tracking-[3px] text-[#cc2200]" onClick={() => setMenuOpen(false)}>
                  Join the Clan
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
