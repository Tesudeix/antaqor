"use client";

import { useEffect, useState, useCallback } from "react";
import { registerServiceWorker, skipWaiting } from "@/lib/pwa";

export default function InstallPrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [swReg, setSwReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    registerServiceWorker().then((reg) => {
      if (reg) setSwReg(reg);
    });

    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSwReg(detail.registration);
      setShowUpdate(true);
    };
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);

  const handleUpdate = useCallback(() => {
    if (swReg) skipWaiting(swReg);
    setShowUpdate(false);
    window.location.reload();
  }, [swReg]);

  if (!showUpdate) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[195] sm:left-auto sm:right-4 sm:max-w-sm"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <div className="flex items-center justify-between gap-3 rounded-none border border-[rgba(16,128,202,0.25)] bg-[#eef2f6] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
        <p className="text-[13px] font-medium text-[#0e1726]">
          Шинэ хувилбар бэлэн байна
        </p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-none bg-[#1080CA] px-4 py-1.5 text-[12px] font-bold text-[#0E0E10]"
        >
          Шинэчлэх
        </button>
      </div>
    </div>
  );
}
