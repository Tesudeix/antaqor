"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const ADMIN_EMAILS = ["antaqor@gmail.com"];

interface MembershipState {
  loading: boolean;
  isMember: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  expired: boolean;
  expiresAt: string | null;
}

export function useMembership(): MembershipState {
  const { data: session, status } = useSession();
  const [state, setState] = useState<MembershipState>({
    loading: true,
    isMember: false,
    isAdmin: false,
    isLoggedIn: false,
    expired: false,
    expiresAt: null,
  });

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setState({
        loading: false,
        isMember: false,
        isAdmin: false,
        isLoggedIn: false,
        expired: false,
        expiresAt: null,
      });
      return;
    }

    const email = session.user.email || "";
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    if (isAdmin) {
      setState({
        loading: false,
        isMember: true,
        isAdmin: true,
        isLoggedIn: true,
        expired: false,
        expiresAt: null,
      });
      return;
    }

    const check = async () => {
      try {
        const res = await fetch("/api/clan/status");
        const data = await res.json();
        setState({
          loading: false,
          isMember: !!data.isMember,
          isAdmin: false,
          isLoggedIn: true,
          expired: !!data.expired,
          expiresAt: data.expiresAt || null,
        });
      } catch {
        setState({
          loading: false,
          isMember: false,
          isAdmin: false,
          isLoggedIn: true,
          expired: false,
          expiresAt: null,
        });
      }
    };

    check();
  }, [session, status]);

  return state;
}
