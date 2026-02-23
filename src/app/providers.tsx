"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </SessionProvider>
  );
}
