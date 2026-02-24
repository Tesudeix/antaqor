"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      const dismissed = localStorage.getItem("pwa-dismissed");
      if (!dismissed) {
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] md:bottom-6 md:left-auto md:right-6 md:w-[360px]">
      <div className="border border-[#1c1c1c] bg-[#0f0f0f] p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#030303] text-xl font-black text-[#cc2200]">
            A
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-bold text-[#ede8df]">Antaqor суулгах</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#5a5550]">
              Хурдан хандалтын тулд нүүр хуудсандаа нэмнэ үү
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={handleInstall} className="bg-[#cc2200] px-4 py-2 text-[10px] font-bold uppercase tracking-[2px] text-[#ede8df] transition hover:bg-[#e8440f]">
                Суулгах
              </button>
              <button onClick={handleDismiss} className="px-4 py-2 text-[10px] uppercase tracking-[2px] text-[#5a5550] transition hover:text-[#c8c8c0]">
                Одоо биш
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
