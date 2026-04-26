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
    <div className="fixed left-0 right-0 top-0 z-[200] animate-[slideDown_0.3s_ease-out]">
      <div className="flex items-center justify-between gap-3 bg-[#141414] border-b border-[rgba(239,44,88,0.2)] px-4 py-3">
        <p className="text-[13px] font-medium text-[#E8E8E8]">
          Шинэ хувилбар бэлэн байна
        </p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-[4px] bg-[#EF2C58] px-4 py-1.5 text-[12px] font-bold text-[#F8F8F6]"
        >
          Шинэчлэх
        </button>
      </div>
    </div>
  );
}
