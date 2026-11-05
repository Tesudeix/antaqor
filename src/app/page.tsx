"use client";

import { useSession } from "next-auth/react";
import FeedSection from "@/components/FeedSection";
import GuestHome from "@/components/GuestHome";

export default function Home() {
  const { data: session, status } = useSession();
  if (status === "loading") {
    return <div className="flex min-h-[60vh] items-center justify-center" aria-label="Ачаалж байна"><div className="h-2 w-2 animate-pulse bg-[#2E29FF]" /></div>;
  }
  return session ? <FeedSection /> : <GuestHome />;
}
