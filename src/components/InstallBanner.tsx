"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Device =
  | "ios-safari"        // iPhone/iPad Safari → Share → Add to Home Screen
  | "ios-chrome"        // iPhone Chrome (must open in Safari)
  | "android-chrome"    // Android Chrome → beforeinstallprompt
  | "android-other"     // Android Firefox/Samsung/etc.
  | "mac-safari"        // macOS Safari 17+ → File → Add to Dock
  | "desktop-chromium"  // Chrome/Edge/Brave → beforeinstallprompt
  | "desktop-firefox"   // Firefox — no PWA install
  | "unknown";

const NEON = "#1080CA";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isMacDesktop = /Macintosh/.test(ua) && (!navigator.maxTouchPoints || navigator.maxTouchPoints < 2);
  const isWindowsDesktop = /Windows/.test(ua);
  const isLinuxDesktop = /Linux/.test(ua) && !isAndroid;

  // Browser detection (specific to general)
  const isChromeIOS = /CriOS/.test(ua);
  const isFirefoxIOS = /FxiOS/.test(ua);
  const isEdgeIOS = /EdgiOS/.test(ua);
  const isSafari =
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Edg|OPR/.test(ua);
  const isEdge = /Edg/.test(ua);
  const isOpera = /OPR/.test(ua);
  const isFirefox = /Firefox/.test(ua) && !isFirefoxIOS;
  const isChromium = /Chrome|Chromium/.test(ua) && !isEdge && !isOpera;

  if (isIOS) {
    if (isChromeIOS || isFirefoxIOS || isEdgeIOS) return "ios-chrome";
    return "ios-safari";
  }
  if (isAndroid) {
    if (isChromium || isEdge) return "android-chrome";
    return "android-other";
  }
  if (isMacDesktop && isSafari) return "mac-safari";
  if ((isMacDesktop || isWindowsDesktop || isLinuxDesktop) && (isChromium || isEdge)) {
    return "desktop-chromium";
  }
  if (isFirefox) return "desktop-firefox";
  return "unknown";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

const SHOW_MS = 10_000;     // auto-hide after 10s
const ENTER_DELAY_MS = 800; // wait 0.8s after page load before showing

export default function InstallBanner() {
  const pathname = usePathname();
  const onSilentRoute = pathname?.startsWith("/tools/nano-banano") || pathname?.startsWith("/admin");
  const [device, setDevice] = useState<Device>("unknown");
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (onSilentRoute) return;
    if (isStandalone()) return; // Hard hide — running as installed PWA

    const d = detectDevice();
    // Desktop never sees the install prompt — desktop users have Chrome's
    // own install icon in the URL bar plus we don't want to nag laptops.
    const isDesktop =
      d === "desktop-chromium" || d === "desktop-firefox" || d === "mac-safari" || d === "unknown";
    if (isDesktop) return;

    // No sessionStorage suppression — banner returns on every refresh.
    // The X button only hides for the current page view; reload re-shows it.
    setDevice(d);

    // Brief enter delay so the user sees the page first.
    const enterTimer = setTimeout(() => setShow(true), ENTER_DELAY_MS);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setShow(false);
      setEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      clearTimeout(enterTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // Auto-hide 10s after appearing. If the install sheet opens, pause the
  // timer — user is engaged, don't yank the banner mid-read.
  useEffect(() => {
    if (!show || sheetOpen) return;
    const t = setTimeout(() => {
      setClosing(true);
      setTimeout(() => setShow(false), 250);
    }, SHOW_MS);
    return () => clearTimeout(t);
  }, [show, sheetOpen]);

  const dismiss = () => {
    // State-only — no sessionStorage. Refresh brings the banner back.
    setShow(false);
  };

  const onCta = async () => {
    // Devices with native install prompt → fire it directly
    if (evt && (device === "android-chrome" || device === "desktop-chromium")) {
      try {
        await evt.prompt();
        const { outcome } = await evt.userChoice;
        if (outcome === "accepted") setShow(false);
      } finally {
        setEvt(null);
      }
      return;
    }
    // Otherwise show device-specific instructions
    setSheetOpen(true);
  };

  if (!show || onSilentRoute) return null;

  const ctaLabel = evt && (device === "android-chrome" || device === "desktop-chromium") ? "Суулгах" : "Үзүүлэх";

  return (
    <>
      <div
        className="relative w-full"
        style={{
          animation: closing ? "slideUp 0.25s ease-in forwards" : "slideDown 0.3s ease-out",
          transformOrigin: "top",
        }}
        data-pwa-device={device}
      >
        <div
          className="relative flex items-center justify-between gap-3 overflow-hidden border-b px-4 py-2.5 sm:px-5"
          style={{
            background: "linear-gradient(135deg, rgba(16,128,202,0.14) 0%, #f2f5f8 70%)",
            borderColor: "rgba(16,128,202,0.35)",
            paddingTop: "max(env(safe-area-inset-top), 10px)",
          }}
        >
          {/* 10-second progress bar — shrinks left to right under the bar.
              Pauses (held at 100%) while the install sheet is open. */}
          <span
            className="pointer-events-none absolute bottom-0 left-0 h-[2px]"
            style={{
              background: NEON,
              width: "100%",
              animation: !sheetOpen ? "pwaShrink 10s linear forwards" : "none",
              boxShadow: "0 0 6px rgba(16,128,202,0.6)",
            }}
          />
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none"
              style={{ background: NEON, boxShadow: "0 0 12px rgba(16,128,202,0.45)" }}
            >
              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-black text-white">Antaqor нэмэх</div>
              <div className="truncate text-[10px] text-[#5b6573]">{deviceTagline(device)}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onCta}
              className="rounded-none px-3 py-1.5 text-[11px] font-black text-white transition active:scale-95"
              style={{ background: NEON, boxShadow: "0 0 12px rgba(16,128,202,0.4)" }}
            >
              {ctaLabel}
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Хаах"
              className="flex h-7 w-7 items-center justify-center rounded-none text-[#6b7280] transition hover:bg-white/5 hover:text-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {sheetOpen && <InstallSheet device={device} onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function deviceTagline(device: Device): string {
  switch (device) {
    case "ios-safari":      return "iPhone Safari · Share → Add";
    case "ios-chrome":      return "Safari дээр нээж нэмнэ";
    case "android-chrome":  return "Android Chrome · нэг товчоор";
    case "android-other":   return "Chrome дээр нээж нэмнэ";
    case "mac-safari":      return "Mac Safari · File → Add to Dock";
    case "desktop-chromium": return "Chrome / Edge · нэг товчоор";
    case "desktop-firefox":  return "Firefox дээр суулгах боломжгүй";
    default:                 return "Хөтөч таних боломжгүй";
  }
}

// ─── Device-specific install instructions ───────────────────────────────
function InstallSheet({ device, onClose }: { device: Device; onClose: () => void }) {
  const guide = guideFor(device);
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      style={{ animation: "slideDown 0.2s ease-out" }}
    >
      <div
        className="w-full max-w-md rounded-t-[12px] border border-[rgba(16,128,202,0.35)] bg-[#f2f5f8] p-5 sm:rounded-none"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: NEON, boxShadow: "0 0 8px #1080CA" }} />
            <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: NEON }}>{guide.tag}</span>
          </div>
          <button onClick={onClose} aria-label="Хаах" className="rounded-none p-1 text-[#6b7280] hover:text-white">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h2 className="text-[18px] font-black leading-tight text-white">{guide.title}</h2>
        {guide.subtitle && <p className="mt-1 text-[11px] text-[#6b7280]">{guide.subtitle}</p>}

        <div className="mt-5 space-y-3">
          {guide.steps.map((s, i) => (
            <Step key={i} n={i + 1}>
              <span dangerouslySetInnerHTML={{ __html: s.text }} />
              {s.icon}
            </Step>
          ))}
        </div>

        {guide.note && (
          <p className="mt-3 text-[10px] leading-relaxed text-[#6b7280]" dangerouslySetInnerHTML={{ __html: guide.note }} />
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-none py-3 text-[12px] font-black text-white transition active:scale-[0.98]"
          style={{ background: NEON, boxShadow: "0 0 18px rgba(16,128,202,0.4)" }}
        >
          Ойлголоо
        </button>
      </div>
    </div>
  );
}

interface Guide {
  tag: string;
  title: string;
  subtitle?: string;
  steps: { text: string; icon?: React.ReactNode }[];
  note?: string;
}

function guideFor(device: Device): Guide {
  const shareIos = (
    <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-none border border-[rgba(15,23,38,0.12)] text-[#0A84FF]">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7l3-3 3 3M12 4v12" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13v5a2 2 0 002 2h10a2 2 0 002-2v-5" />
      </svg>
    </span>
  );
  const plusIcon = (
    <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-none border border-[rgba(15,23,38,0.12)] text-white">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </span>
  );
  const dotsIcon = (
    <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-none border border-[rgba(15,23,38,0.12)] text-white">
      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
      </svg>
    </span>
  );

  switch (device) {
    case "ios-safari":
      return {
        tag: "IPHONE · SAFARI",
        title: "3 алхамаар Antaqor нэмнэ",
        subtitle: "iPhone Safari нь автомат суулгах товчгүй",
        steps: [
          { text: "Доорх <b class='text-white'>Share</b> товчийг дар", icon: shareIos },
          { text: "Доош scroll хийж <b class='text-white'>\"Add to Home Screen\"</b> сонго", icon: plusIcon },
          { text: "Баруун дээд <b class='text-white'>\"Add\"</b> дар → home screen дээр <b class='text-white'>Antaqor</b> гарна" },
        ],
        note: "Хэрэв \"Add to Home Screen\" харагдахгүй бол share жагсаалтаас <b class='text-white'>\"Edit Actions\"</b> дарж нэмнэ",
      };

    case "ios-chrome":
      return {
        tag: "IPHONE · CHROME / FIREFOX",
        title: "Эхлээд Safari дээр нээ",
        subtitle: "iPhone дээр зөвхөн Safari аппликейшн суулгахыг зөвшөөрдөг",
        steps: [
          { text: "Энэ хуудасны URL-ийг хуул эсвэл хуваалц" },
          { text: "<b class='text-white'>Safari</b> нээж URL-ийг paste хий" },
          { text: "Доорх <b class='text-white'>Share</b> товч → <b class='text-white'>\"Add to Home Screen\"</b>", icon: shareIos },
        ],
      };

    case "android-chrome":
      return {
        tag: "ANDROID · CHROME",
        title: "Нэг товчоор суулгана",
        subtitle: "Дээрх \"Суулгах\" товчийг дар. Эсвэл гар аргаар:",
        steps: [
          { text: "Баруун дээд <b class='text-white'>3 цэг</b> цэс", icon: dotsIcon },
          { text: "<b class='text-white'>\"Install app\"</b> эсвэл <b class='text-white'>\"Add to Home screen\"</b>" },
          { text: "<b class='text-white'>\"Install\"</b> дар" },
        ],
      };

    case "android-other":
      return {
        tag: "ANDROID",
        title: "Chrome дээр нээж нэмэх",
        subtitle: "Энэ хөтөч аппликейшн суулгах хувилбарыг бүрэн дэмждэггүй",
        steps: [
          { text: "URL-ийг хуул" },
          { text: "<b class='text-white'>Google Chrome</b> нээж paste хий" },
          { text: "Цэснээс <b class='text-white'>\"Install app\"</b> сонго" },
        ],
      };

    case "mac-safari":
      return {
        tag: "MAC · SAFARI",
        title: "Dock-д Antaqor нэмэх",
        subtitle: "macOS Safari 17+ дэмжинэ",
        steps: [
          { text: "Дээд цэснээс <b class='text-white'>File</b> сонго" },
          { text: "<b class='text-white'>\"Add to Dock…\"</b> дар" },
          { text: "<b class='text-white'>\"Add\"</b> баталгаажуул" },
        ],
        note: "Mac Safari < 17 дээр энэ функц байхгүй. <b class='text-white'>Chrome</b> ашиглана уу.",
      };

    case "desktop-chromium":
      return {
        tag: "DESKTOP · CHROME / EDGE",
        title: "Нэг товчоор суулгана",
        subtitle: "Дээрх \"Суулгах\" товчийг дар. Эсвэл гар аргаар:",
        steps: [
          { text: "URL мөрний баруун талд <b class='text-white'>install икон</b> дар" },
          { text: "Эсвэл <b class='text-white'>3 цэг</b> цэс → <b class='text-white'>\"Install Antaqor\"</b>", icon: dotsIcon },
          { text: "<b class='text-white'>\"Install\"</b> баталгаажуул" },
        ],
      };

    case "desktop-firefox":
      return {
        tag: "FIREFOX",
        title: "Firefox дэмждэггүй",
        subtitle: "Firefox PWA суулгах функцыг хассан",
        steps: [
          { text: "<b class='text-white'>Chrome</b> эсвэл <b class='text-white'>Edge</b> хөтөч ашиглана уу" },
          { text: "Эсвэл хуудсыг <b class='text-white'>Bookmark</b> хий" },
        ],
      };

    default:
      return {
        tag: "ХӨТӨЧ ТАНИГДААГҮЙ",
        title: "Дэмжигдэх хөтөч ашиглана уу",
        steps: [
          { text: "<b class='text-white'>iPhone:</b> Safari" },
          { text: "<b class='text-white'>Android:</b> Chrome" },
          { text: "<b class='text-white'>Desktop:</b> Chrome / Edge" },
        ],
      };
  }
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-none border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-[12px] font-black"
        style={{ background: "rgba(16,128,202,0.15)", color: NEON, border: `1px solid ${NEON}40` }}
      >
        {n}
      </span>
      <div className="flex flex-1 items-center gap-2 text-[13px] text-[#334155]">{children}</div>
    </div>
  );
}
