"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import ComposerModal from "@/components/ComposerModal";
import PushOptIn from "@/components/PushOptIn";
import RealtimeBridge from "@/components/RealtimeBridge";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
      <ComposerModal />
      <PushOptIn />
      <RealtimeBridge />
    </SessionProvider>
  );
}
