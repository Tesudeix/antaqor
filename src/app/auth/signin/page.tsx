"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginCard from "@/components/LoginCard";

// Thin wrapper — the login UI lives in the shared <LoginCard> so /auth/signin
// and the chat logged-out state are guaranteed identical.
//
// `callbackUrl` is what NextAuth — and the /world gate in nginx — append when
// they bounce someone here. Honouring it is what lets a deep link survive a
// login instead of dumping the visitor on the homepage. Only same-site paths
// are accepted: a value starting with `//` or carrying a scheme would turn our
// own login into an open redirect.
function SignInInner() {
  const raw = useSearchParams().get("callbackUrl") || "";
  const next = /^\/(?!\/)/.test(raw) ? raw : "/";
  return <LoginCard next={next} />;
}

export default function SignIn() {
  return (
    <Suspense fallback={<LoginCard />}>
      <SignInInner />
    </Suspense>
  );
}
