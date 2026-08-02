"use client";

import { useSession } from "next-auth/react";
import HomeLanding from "@/components/HomeLanding";
import MemberDashboard from "@/components/MemberDashboard";

// ─── / — the funnel switch ───
// Guest → conversion landing. Logged-in (free or paid) → member dashboard.
// The community feed lives at /feed.

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#1080CA]" />
      </div>
    );
  }

  return session ? <MemberDashboard /> : <HomeLanding />;
}
