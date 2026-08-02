"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/**
 * Google Identity Services button. Needs NEXT_PUBLIC_GOOGLE_CLIENT_ID and the
 * site origin registered under "Authorized JavaScript origins" in Google
 * Cloud Console. Renders nothing when the client id is absent.
 *
 * UX: fixed-height slot (no layout jump while GSI loads), Mongolian locale,
 * full card width, framed as the one-tap fast path.
 */
export default function GoogleSignInButton({ next = "/" }: { next?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const init = () => {
      const gsi = window.google?.accounts.id;
      if (!gsi || !ref.current) return;
      gsi.initialize({
        client_id: clientId,
        callback: async (response) => {
          const res = await signIn("google-idtoken", {
            idToken: response.credential,
            redirect: false,
          });
          if (res?.ok) {
            window.location.href = next;
          } else {
            setError(res?.error || "Google нэвтрэлт амжилтгүй боллоо");
          }
        },
      });
      gsi.renderButton(ref.current, {
        theme: "filled_black",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        logo_alignment: "left",
        locale: "mn",
        width: 336,
      });
      setReady(true);
    };

    if (window.google) {
      init();
      return;
    }
    const existing = document.getElementById("gsi-client-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }
    const script = document.createElement("script");
    script.id = "gsi-client-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [next]);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  return (
    <div className="mt-4">
      <div className="chrome mb-2 flex items-center gap-2 text-[8px] font-bold text-[#84848C]">
        <span className="text-[#1080CA]">▸</span> ХАМГИЙН ХУРДАН — НЭГ ТОВШИЛТ
      </div>
      <div className="relative min-h-[44px] rounded-[4px]">
        {!ready && (
          <div className="absolute inset-0 flex h-[44px] items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0a0a0c]">
            <span className="chrome text-[8px] font-bold text-[#84848C]">GOOGLE АЧААЛЖ БАЙНА…</span>
          </div>
        )}
        <div ref={ref} className="flex justify-center" />
      </div>
      {error && (
        <p className="mt-2 text-center text-[11px]" style={{ color: "#FFFFFF" }}>
          {error}
        </p>
      )}
    </div>
  );
}
