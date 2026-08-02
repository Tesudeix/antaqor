"use client";

// Updates the document's <meta name="theme-color"> while the user is inside
// /yuki/*. iOS PWAs (and Chrome on Android) use this to tint the status bar
// and the bottom safe-area, so without it the dark Antaqor color bleeds in
// even though the CSS already paints the page white.

import { useEffect } from "react";

const YUKI_THEME = "#FFFFFF";

export function YukiThemeMount() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content") || "#060608";
    if (meta) meta.setAttribute("content", YUKI_THEME);
    // Apple-specific status bar style — `default` = dark text on light bg.
    const appleMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-status-bar-style"]'
    );
    const prevApple = appleMeta?.getAttribute("content") || "black-translucent";
    if (appleMeta) appleMeta.setAttribute("content", "default");
    return () => {
      if (meta) meta.setAttribute("content", prev);
      if (appleMeta) appleMeta.setAttribute("content", prevApple);
    };
  }, []);
  return null;
}
