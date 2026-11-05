"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import LoginCard from "@/components/LoginCard";
import ChatHub from "./ChatHub";

/* ─── Чатын бүрхүүл — Instagram DM-ийн хоёр багана (2026-10-06) ───────────
   lg+: зүүнд жагсаалт (380px), баруунд нээлттэй яриа эсвэл хоосон төлөв.
   Жагсаалт нь layout-д байгаа тул яриа солиход дахин ачаалагдахгүй.
   Утсан дээр: /chat = жагсаалт, /chat/[id] = зөвхөн яриа (буцах товчтой). */
export default function ChatShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const isRoot = pathname === "/chat";

  if (status === "unauthenticated") {
    return (
      <LoginCard
        next={pathname || "/chat"}
        onSuccess={() => router.refresh()}
        heading="Чатад нэвтрэх"
        subtitle="Гишүүдтэй шууд ярилцахын тулд нэвтэрнэ үү"
      />
    );
  }

  return (
    <div
      className="-mt-4 overflow-hidden md:-mt-8 lg:mt-0 lg:grid lg:h-[calc(100vh-48px)] lg:grid-cols-[380px_minmax(0,1fr)] lg:rounded-[4px] lg:border"
      style={{ borderColor: "var(--line, rgba(255,255,255,0.12))" }}
    >
      <aside
        className={`${isRoot ? "block" : "hidden"} min-h-0 lg:block lg:border-r`}
        style={{ borderColor: "var(--line, rgba(255,255,255,0.12))" }}
      >
        <ChatHub />
      </aside>
      <section className={`${isRoot ? "hidden" : "block"} min-h-0 min-w-0 lg:block`}>{children}</section>
    </div>
  );
}
