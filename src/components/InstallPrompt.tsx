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
      if (!dismissed) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] md:bottom-6 md:left-auto md:right-6 md:w-[320px]">
      <div className="rounded-xl border border-[#1a1a22] bg-[#0c0c10] p-4 shadow-2xl">
        <p className="text-[13px] font-semibold text-[#e8e6e1]">Antaqor суулгах</p>
        <p className="mt-1 text-[12px] text-[#6b6b78]">Хурдан хандалтын тулд нүүр хуудсандаа нэмнэ үү</p>
        <div className="mt-3 flex gap-2">
          <button onClick={handleInstall} className="btn-primary !py-2 !px-4 !text-[12px]">
            Суулгах
          </button>
          <button onClick={handleDismiss} className="text-[12px] text-[#6b6b78] transition hover:text-[#e8e6e1]">
            Одоо биш
          </button>
        </div>
      </div>
    </div>
  );
}
