"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMembership } from "@/lib/useMembership";

/* Хоёр өөр шалгуурыг нэг бүрхүүл барьдаг байсан: "нэвтэрсэн үү" ба
   "төлсөн үү". Ихэнх газарт хоёулаа хэрэгтэй (курс, хэрэгсэл), гэхдээ
   ПОСТ БИЧИХЭД зөвхөн эхнийх нь хэрэгтэй — үнэгүй хэрэглэгч бичиж чадахгүй
   бол үнэгүй урсгалд контент хэзээ ч үүсэхгүй, тэр урсгал үүрд хоосон
   үлдэнэ. Тиймээс гишүүнчлэлийн шаардлагыг сонголт болгов. */
export default function PaywallGate({
  children,
  requireMembership = true,
}: {
  children: React.ReactNode;
  requireMembership?: boolean;
}) {
  const { loading, isMember, isAdmin, isLoggedIn } = useMembership();
  const router = useRouter();
  const allowed = requireMembership ? isMember || isAdmin : true;

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.replace("/auth/signin");
    } else if (!allowed) {
      router.replace("/pricing");
    }
  }, [loading, isLoggedIn, allowed, router]);

  if (loading || !isLoggedIn || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }

  return <>{children}</>;
}
