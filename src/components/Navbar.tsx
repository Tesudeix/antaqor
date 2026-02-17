"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Antaqor
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-4 md:flex">
          {session ? (
            <>
              <Link
                href="/posts/new"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                New Post
              </Link>
              <Link
                href={`/profile/${(session.user as { id: string }).id}`}
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Profile
              </Link>
              <button
                onClick={() => signOut()}
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-gray-200 px-4 py-3 md:hidden dark:border-gray-800">
          <div className="flex flex-col gap-3">
            {session ? (
              <>
                <Link href="/posts/new" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>
                  New Post
                </Link>
                <Link href={`/profile/${(session.user as { id: string }).id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <button onClick={() => { signOut(); setMenuOpen(false); }} className="text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>
                  Sign In
                </Link>
                <Link href="/auth/signup" className="text-sm font-medium text-gray-700 dark:text-gray-300" onClick={() => setMenuOpen(false)}>
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
