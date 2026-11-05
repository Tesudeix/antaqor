"use client";

import { useEffect, useState } from "react";

/* ─── ГОРИМ СОЛИГЧ (2026-10-06-нд сэргээв) ───────────────────────────────
   Ганц хөшүүрэг: <html data-theme="light|dark">. Бүх өнгө үүнээс уншигдана
   (globals.css → theme-light.css → theme-light-extra.css §10), тиймээс
   энэ товч нь өөрөө ямар ч өнгө мэддэггүй — зөвхөн атрибутыг сольдог.

   АНХДАГЧ НЬ ГЭРЭЛ (#F8F9FC). `layout.tsx` нь <html data-theme="light">-ээр
   зурагдаж, толгой дахь блоклох скрипт хадгалсан сонголтыг (dark) зурагдахаас
   ӨМНӨ тавьдаг тул эхний фрэйм л зөв — FOUC байхгүй.

   Харагдах байдлаа React-ийн state-ээс БИШ, атрибутаас CSS-ээр авдаг
   (`theme-toggle__…` анги theme-light.css-д). Сервер дээр localStorage
   байхгүй тул state-ээс хамаарвал бүлүүр hydration дээр харайна. */

export const THEME_KEY = "antaqor-theme";
export type Theme = "light" | "dark";

/** Хөтчийн/PWA-ийн хүрээ хуудастайгаа нэг өнгөтэй байх ёстой — эс бөгөөс
 *  гэрэл горимд утасны дээд тал хар зураас болж үлдэнэ. */
function syncBrowserChrome(next: Theme) {
  const color = next === "dark" ? "#0A0A0A" : "#F8F9FC";
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

/** Горимыг тавьж, санана. Бүх товч ЯГ энэ нэг хөшүүргийг татна. */
export function applyTheme(next: Theme, animate = true) {
  const root = document.documentElement;

  if (animate) {
    /* Шилжилтийг зөвхөн солих МӨЧИД асаана. Байнга асаалттай байвал хуудас
       ачаалах бүрд бүх элемент өнгөө нааш гүйлгэж, энгийн hover бүр удаашрана. */
    root.classList.add("theme-anim");
    const w = window as Window & { __antaqorThemeAnim?: number };
    window.clearTimeout(w.__antaqorThemeAnim);
    w.__antaqorThemeAnim = window.setTimeout(() => root.classList.remove("theme-anim"), 420);
  }

  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* private mode — санахгүй ч ажиллана */
  }
  syncBrowserChrome(next);
  window.dispatchEvent(new CustomEvent("antaqor:theme", { detail: next }));
}

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

const Sun = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const Moon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
  </svg>
);

export default function ThemeToggle({
  className = "",
  variant = "switch",
}: {
  className?: string;
  /** "icon" — утасны дээд мөрөнд: 36px дугуй товч, зөвхөн дараагийн горимын
      дүрс. Тэр мөрөнд хоног + кредит + хонх + аватар аль хэдийн зогсдог тул
      56px-ийн шилжүүлэгч 375px дэлгэцэнд багтахгүй. */
  variant?: "switch" | "icon";
}) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(readTheme());
    syncBrowserChrome(readTheme());
    // Толгой дээр нэг, хажуугийн цэсэнд нэг товч байдаг — хоёулаа нэг л
    // үнэнийг харуулна.
    const onChange = () => setTheme(readTheme());
    window.addEventListener("antaqor:theme", onChange);
    return () => window.removeEventListener("antaqor:theme", onChange);
  }, []);

  const dark = theme === "dark";
  const label = dark ? "Гэрэл горимд шилжих" : "Харанхуй горимд шилжих";
  /* Дарах агшинд DOM-оос уншина — hydration дуусаагүй байхад дарсан ч
     зөв тал руу нь эргэнэ. */
  const toggle = () => applyTheme(readTheme() === "dark" ? "light" : "dark");

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        title={label}
        className={`press flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line,rgba(255,255,255,0.12))] text-[var(--nav-fg-strong)] transition hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-fg-strong)] ${className}`.trim()}
      >
        <span className="block h-[18px] w-[18px]">{dark ? Sun : Moon}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={dark ? "Гэрэл горим" : "Харанхуй горим"}
      onClick={toggle}
      className={`theme-toggle ${className}`.trim()}
    >
      <span className="theme-toggle__thumb" aria-hidden="true" />
      <span className="theme-toggle__ico theme-toggle__ico--sun">{Sun}</span>
      <span className="theme-toggle__ico theme-toggle__ico--moon">{Moon}</span>
    </button>
  );
}
