"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com", "cyberempire4444@gmail.com"];

interface MembershipState {
  loading: boolean;
  isMember: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
  expired: boolean;
  expiresAt: string | null;
  /* 2026-08-26-ны төлбөрт шилжилт. `hasAccess` нь "гишүүн үү" гэсэн
     асуултаас ӨӨР: хуучин хэрэглэгч 7 хоногийн түр эрхээр орж болно.
     UI дандаа `hasAccess`-ийг л шалгана, `isMember`-ийг биш. */
  hasAccess: boolean;
  inGrace: boolean;
  graceEndsAt: string | null;
  graceDaysLeft: number;
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
    hasAccess: false,
    inGrace: false,
    graceEndsAt: null,
    graceDaysLeft: 0,
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
        hasAccess: false,
        inGrace: false,
        graceEndsAt: null,
        graceDaysLeft: 0,
      });
      return;
    }

    const email = session.user.email || "";
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

    if (isSuperAdmin) {
      setState({
        loading: false,
        isMember: true,
        isAdmin: true,
        isLoggedIn: true,
        expired: false,
        expiresAt: null,
        hasAccess: true,
        inGrace: false,
        graceEndsAt: null,
        graceDaysLeft: 0,
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
          isAdmin: !!data.isAdmin,
          isLoggedIn: true,
          expired: !!data.expired,
          expiresAt: data.expiresAt || null,
          hasAccess: !!data.hasAccess,
          inGrace: !!data.inGrace,
          graceEndsAt: data.graceEndsAt || null,
          graceDaysLeft: Number(data.graceDaysLeft) || 0,
        });
      } catch {
        setState({
          loading: false,
          isMember: false,
          isAdmin: false,
          isLoggedIn: true,
          expired: false,
          expiresAt: null,
          hasAccess: false,
          inGrace: false,
          graceEndsAt: null,
          graceDaysLeft: 0,
        });
      }
    };

    check();
  }, [session, status]);

  return state;
}
