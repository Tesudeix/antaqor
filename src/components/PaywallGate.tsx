"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMembership } from "@/lib/useMembership";

export default function PaywallGate({ children }: { children: React.ReactNode }) {
  const { loading, isMember, isLoggedIn } = useMembership();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn) {
      router.replace("/auth/signin");
    } else if (!isMember) {
      router.replace("/clan");
    }
  }, [loading, isLoggedIn, isMember, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (!isLoggedIn || !isMember) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  return <>{children}</>;
}
