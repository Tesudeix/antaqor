"use client";

import { useEffect, useState, useCallback } from "react";
import {
  type BeforeInstallPromptEvent,
  isInstalled,
  isIOS,
  registerServiceWorker,
  skipWaiting,
} from "@/lib/pwa";

const STORAGE_KEY = "pwa-install-prompt";

function getDismissData(): { count: number; permanent: boolean; lastDismissed: number } {
  if (typeof localStorage === "undefined") return { count: 0, permanent: false, lastDismissed: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, permanent: false, lastDismissed: 0 };
    return JSON.parse(raw);
  } catch {
    return { count: 0, permanent: false, lastDismissed: 0 };
  }
}

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  if (isInstalled()) return false;
  const data = getDismissData();
  if (data.permanent) return false;
  if (data.count === 0) return true;
  // After first dismiss: wait 1 day. After second: wait 3 days. After third+: wait 7 days.
  const waitDays = data.count === 1 ? 1 : data.count === 2 ? 3 : 7;
  return Date.now() - data.lastDismissed > waitDays * 24 * 60 * 60 * 1000;
}

function recordDismiss(permanent: boolean) {
  const data = getDismissData();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      count: data.count + 1,
      permanent,
      lastDismissed: Date.now(),
    })
  );
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isiOS, setIsIOS] = useState(false);
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

    if (!shouldShow()) return;

    if (isIOS()) {
      setIsIOS(true);
      setShowModal(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowModal(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show modal for all browsers (even if beforeinstallprompt doesn't fire)
    const timer = setTimeout(() => {
      if (!isInstalled() && shouldShow()) {
        setShowModal(true);
      }
    }, 2000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("sw-update-available", onUpdate);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowModal(false);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    recordDismiss(false);
  }, []);

  const handleNeverShow = useCallback(() => {
    setShowModal(false);
    recordDismiss(true);
  }, []);

  const handleUpdate = useCallback(() => {
    if (swReg) skipWaiting(swReg);
    setShowUpdate(false);
    window.location.reload();
  }, [swReg]);

  // ─── Update toast ───
  if (showUpdate) {
    return (
      <div className="fixed left-0 right-0 top-0 z-[200] animate-[slideDown_0.3s_ease-out]">
        <div className="flex items-center justify-between gap-3 bg-[#141414] border-b border-[rgba(255,255,1,0.2)] px-4 py-3">
          <p className="text-[13px] font-medium text-[#FAFAFA]">
            Шинэ хувилбар бэлэн байна
          </p>
          <button
            onClick={handleUpdate}
            className="shrink-0 rounded-[4px] bg-[#FFFF01] px-4 py-1.5 text-[12px] font-bold text-[#0A0A0A]"
          >
            Шинэчлэх
          </button>
        </div>
      </div>
    );
  }

  // ─── Install Modal ───
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-[380px] mx-4 mb-4 sm:mb-0 animate-[slideUp_0.3s_ease-out] rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.06)] overflow-hidden">
        {/* Header accent */}
        <div className="h-[3px] bg-[#FFFF01]" />

        <div className="px-6 pt-6 pb-5">
          {/* App icon + name */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#0A0A0A] border border-[rgba(255,255,255,0.06)]">
              <span className="text-[20px] font-black text-[#FFFF01]">A</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#FAFAFA]">Antaqor</h2>
              <p className="text-[11px] text-[#6B6B6B]">antaqor.com</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-[13px] leading-[1.6] text-[#A3A3A3] mb-5">
            Antaqor аппыг суулгаад илүү хурдан, офлайн горимтой ашиглаарай.
          </p>

          {/* iOS instructions */}
          {isiOS && (
            <div className="mb-5 rounded-[4px] bg-[#0A0A0A] border border-[rgba(255,255,255,0.06)] p-4">
              <p className="text-[12px] font-bold text-[#FAFAFA] mb-3">Апп суулгах:</p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">1</span>
                  <span>Доорх</span>
                  <svg className="h-4 w-4 shrink-0 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0 0l-4-4m4 4l4-4M4 5h16" />
                  </svg>
                  <span>товч дарна</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">2</span>
                  <span><span className="font-semibold text-[#FAFAFA]">Share</span> дарна</span>
                  <svg className="h-4 w-4 shrink-0 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">3</span>
                  <span>Доош гүйлгээд <span className="font-semibold text-[#FAFAFA]">Add to Home Screen</span> дарна</span>
                </div>
                <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">4</span>
                  <span>Баруун дээд <span className="font-semibold text-[#FAFAFA]">Add</span> дарна</span>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2">
            {!isiOS && deferredPrompt && (
              <button
                onClick={handleInstall}
                className="w-full rounded-[4px] bg-[#FFFF01] py-3 text-[13px] font-bold text-[#0A0A0A] transition hover:brightness-110"
              >
                Суулгах
              </button>
            )}

            {!isiOS && !deferredPrompt && (
              <div className="rounded-[4px] bg-[#0A0A0A] border border-[rgba(255,255,255,0.06)] p-4">
                <p className="text-[12px] font-bold text-[#FAFAFA] mb-3">Апп суулгах:</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">1</span>
                    <span>Хөтчийн <span className="font-semibold text-[#FAFAFA]">⋮</span> цэс дарна</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">2</span>
                    <span><span className="font-semibold text-[#FAFAFA]">Share</span> дарна</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">3</span>
                    <span>Доош гүйлгээд <span className="font-semibold text-[#FAFAFA]">Add to Home Screen</span> дарна</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-[12px] text-[#A3A3A3]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,1,0.12)] text-[10px] font-bold text-[#FFFF01]">4</span>
                    <span><span className="font-semibold text-[#FAFAFA]">Add</span> дарна</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleDismiss}
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-transparent py-2.5 text-[13px] font-medium text-[#A3A3A3] transition hover:text-[#FAFAFA] hover:border-[rgba(255,255,255,0.15)]"
            >
              Дараа
            </button>
          </div>

          {/* Don't show again */}
          <button
            onClick={handleNeverShow}
            className="mt-3 w-full text-center text-[11px] text-[#6B6B6B] transition hover:text-[#A3A3A3]"
          >
            Дахиж бүү харуул
          </button>
        </div>
      </div>
    </div>
  );
}
