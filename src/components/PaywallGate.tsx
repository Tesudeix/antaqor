"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMembership } from "@/lib/useMembership";

export default function PaywallGate({ children }: { children: React.ReactNode }) {
  const { loading, isMember, isAdmin, isLoggedIn } = useMembership();
  const router = useRouter();
  const allowed = isMember || isAdmin;

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.replace("/auth/signin");
    } else if (!allowed) {
      router.replace("/clan?pay=1");
    }
  }, [loading, isLoggedIn, allowed, router]);

  if (loading || !isLoggedIn || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#EF2C58]" />
      </div>
    );
  }

  return <>{children}</>;
}
