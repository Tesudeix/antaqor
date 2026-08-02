// Yuki сормуусны салон — own surface. White background, pink accent.
// Parent root layout provides fonts + session; this layout owns the salon's
// visual identity so the experience reads as Yuki's own app, not Antaqor's.
import type { Metadata } from "next";
import { YukiThemeMount } from "./YukiThemeMount";

export const metadata: Metadata = {
  title: "Yuki — Сормуусны салон",
  description: "Yuki сормуусны салон. Стилистээ сонгож, цагаа онлайнаар захиал.",
};

export default function YukiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="yuki-root min-h-screen text-[#2A1B2A]"
      style={
        {
          // Yuki brand: pink on white. Variables here are referenced inline
          // by Yuki pages so dark Antaqor tokens never leak in.
          "--yuki-pink": "#EC4899",
          "--yuki-pink-soft": "#FBCFE8",
          "--yuki-pink-deep": "#BE185D",
          "--yuki-pink-tint": "#FDF2F8",
          "--yuki-bg": "#FFFFFF",
          "--yuki-surface": "#FDF2F8",
          "--yuki-ink": "#2A1B2A",
          "--yuki-dim": "#94889A",
          background:
            "radial-gradient(80% 60% at 0% 0%, rgba(236,72,153,0.06) 0%, transparent 55%), radial-gradient(70% 50% at 100% 100%, rgba(190,24,93,0.05) 0%, transparent 55%), #FFFFFF",
          color: "#2A1B2A",
        } as React.CSSProperties
      }
    >
      {/* Flips theme-color + iOS status-bar style while inside /yuki/* —
          paints the device safe-area white instead of Antaqor matte black. */}
      <YukiThemeMount />
      {children}
    </div>
  );
}
