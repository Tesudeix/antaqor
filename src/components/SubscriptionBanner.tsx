"use client";

import Link from "next/link";
import { useMembership } from "@/lib/useMembership";

export default function SubscriptionBanner() {
  const { loading, isMember, isAdmin, isLoggedIn } = useMembership();

  // Only show for logged-in users who are NOT paid members
  if (loading || !isLoggedIn || isMember || isAdmin) return null;

  return (
    <div className="sticky top-0 z-[60] flex h-[50px] items-center justify-center gap-3 bg-[#2E29FF] px-4">
      <span className="text-[13px] font-semibold text-white">
        Сургалт, challenge, нийгэмлэгт нэгдэх
      </span>
      <Link
        href="/clan"
        className="rounded-[4px] bg-[#eef2f6] px-4 py-1.5 text-[12px] font-bold text-[#2E29FF] transition hover:bg-[#eef2f6]/90"
      >
        Нэгдэх
      </Link>
    </div>
  );
}
