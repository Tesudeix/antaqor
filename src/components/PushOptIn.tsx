"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  registerServiceWorker,
} from "@/lib/pwa";

const KEY_LAST_PROMPT = "push_last_prompt_at";
const KEY_DECLINED = "push_declined";
// Don't ask again for 14 days after a soft decline. After hard browser deny
// we never ask (browser holds the permission state).
const RETRY_DAYS = 14;
const NEON = "#1080CA";

type Step = "idle" | "ask" | "subscribing" | "done" | "denied";

export default function PushOptIn() {
  const { data: session, status } = useSession();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<Step>("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status !== "authenticated") return;
    if (!isPushSupported()) return;

    // iOS Safari only allows web push when the site is installed as a PWA
    // (Add to Home Screen) and launched from the home-screen icon. In a
    // regular Safari tab, subscribe() throws — don't surface the prompt.
    // Let the InstallBanner drive iOS users through install first.
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standaloneNav = (navigator as Navigator & { standalone?: boolean }).standalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || standaloneNav === true;
    if (isIOS && !isStandalone) return;

    const perm = getNotificationPermission();
    if (perm === "granted") {
      // Already granted in browser — make sure we have a fresh subscription.
      const userId = (session?.user as { id?: string })?.id;
      if (userId) {
        registerServiceWorker().then(() => subscribeToPush(userId).catch(() => {}));
      }
      return;
    }
    if (perm === "denied" || perm === "unsupported") return;

    // perm === "default" — never asked at browser level yet.
    if (localStorage.getItem(KEY_DECLINED) === "1") {
      const last = parseInt(localStorage.getItem(KEY_LAST_PROMPT) || "0", 10);
      if (Date.now() - last < RETRY_DAYS * 86400_000) return;
    }

    // Wait 4s after page load — let the user settle in before asking.
    const t = setTimeout(() => {
      setShow(true);
      setStep("ask");
    }, 4000);
    return () => clearTimeout(t);
  }, [status, session]);

  const enable = async () => {
    setStep("subscribing");
    try {
      const perm = await requestNotificationPermission();
      if (perm === "granted") {
        const userId = (session?.user as { id?: string })?.id;
        if (!userId) {
          setStep("denied");
          return;
        }
        await registerServiceWorker();
        await subscribeToPush(userId);
        setStep("done");
        localStorage.removeItem(KEY_DECLINED);
        setTimeout(() => setShow(false), 1800);
      } else {
        setStep("denied");
        localStorage.setItem(KEY_DECLINED, "1");
        localStorage.setItem(KEY_LAST_PROMPT, String(Date.now()));
        setTimeout(() => setShow(false), 1500);
      }
    } catch (e) {
      console.error("[push] enable failed:", e);
      setStep("denied");
      setTimeout(() => setShow(false), 1500);
    }
  };

  const decline = () => {
    localStorage.setItem(KEY_DECLINED, "1");
    localStorage.setItem(KEY_LAST_PROMPT, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-3 z-[202] sm:left-auto sm:right-4 sm:max-w-sm"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 80px)",
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <div
        className="overflow-hidden rounded-none border bg-[#f2f5f8] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.5)]"
        style={{ borderColor: "rgba(16,128,202,0.35)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
            style={{ background: NEON, boxShadow: "0 0 14px rgba(16,128,202,0.5)" }}
          >
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            {step === "ask" && (
              <>
                <div className="text-[13px] font-black text-white">Мэдэгдэл идэвхжүүлэх</div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-[#5b6573]">
                  Reaction, agent reply, live event эхлэхэд шууд мэдэгдэл авна
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={enable}
                    className="rounded-none px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95"
                    style={{ background: NEON, boxShadow: "0 0 12px rgba(16,128,202,0.4)" }}
                  >
                    Идэвхжүүлэх
                  </button>
                  <button
                    type="button"
                    onClick={decline}
                    className="rounded-none border border-[rgba(15,23,38,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#5b6573] transition hover:text-white"
                  >
                    Дараа
                  </button>
                </div>
              </>
            )}
            {step === "subscribing" && (
              <div className="text-[12px] font-bold text-[#334155]">Идэвхжүүлж байна…</div>
            )}
            {step === "done" && (
              <div className="text-[12px] font-black" style={{ color: NEON }}>
                ✓ Идэвхжсэн
              </div>
            )}
            {step === "denied" && (
              <div className="text-[12px] text-[#5b6573]">Дараа явах товчоор хэдийд ч идэвхжүүлж болно</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
