"use client";

import { useSession } from "next-auth/react";

export function useUserId(): string | null {
  const { data: session } = useSession();
  if (!session?.user) return null;
  const user = session.user as { id?: string };
  return user.id || null;
}
