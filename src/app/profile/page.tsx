"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const NEON = "var(--accent-ink, #2E29FF)";

export default function ProfileIndexPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const id = (session?.user as { id?: string } | undefined)?.id;
      if (id) router.replace(`/profile/${id}`);
    }
  }, [status, session, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#2E29FF]" />
      </div>
    );
  }

  // Guest — show login + register card
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 py-10">
      <div className="w-full">
        <div className="mb-5 text-center">
          <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-2 py-0.5 text-[11px] font-black tracking-[0.18em]" style={{ color: NEON }}>
            ANTAQOR · PROFILE
          </span>
          <h1 className="mt-3 text-[24px] font-black leading-tight text-white sm:text-[28px]">
            Орохын тулд нэвтрэх хэрэгтэй
          </h1>
          <p className="mt-2 text-[13px] text-[#E2E4E8]">
            Профайл, кредит, хадгалсан зураг бүгд таны эзэмшилд орно
          </p>
        </div>

        <div className="space-y-2">
          <Link
            href="/auth/signin"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] py-3 text-[13px] font-black text-white transition active:scale-[0.99]"
            style={{ background: NEON, boxShadow: "0 0 18px rgba(46,41,255,0.4)" }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Нэвтрэх
          </Link>
          <Link
            href="/auth/signup"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[#f2f5f8] py-3 text-[13px] font-black transition active:scale-[0.99]"
            style={{ color: NEON }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Бүртгүүлэх
          </Link>
        </div>

        <p className="mt-5 text-center text-[10px] text-[#E2E4E8]">
          AI Antaqor нийгэмлэгт нэгдээрэй
        </p>
      </div>
    </div>
  );
}
