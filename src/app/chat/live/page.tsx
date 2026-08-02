"use client";

import Link from "next/link";
import LiveChat from "@/components/LiveChat";

// ─── LIVE room — гишүүдийн нэгдсэн realtime чат ───
export default function LiveChatPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-24 pt-6">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="chrome mb-1 flex items-center gap-2 text-[9px] font-bold">
            <span className="text-[#1080CA]">[CHAT]</span>
            <span className="text-[#1080CA]">/////</span>
            <span className="text-[#84848C]">LIVE ROOM · БҮХ ГИШҮҮН</span>
          </div>
          <h1 className="headline text-[22px]">Live чат</h1>
        </div>
        <Link href="/chat" className="chrome shrink-0 text-[9px] font-bold text-[#84848C] hover:text-[#1080CA]">
          ХУВИЙН ЧАТ →
        </Link>
      </div>
      <LiveChat />
    </main>
  );
}
