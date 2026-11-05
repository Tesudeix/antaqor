import type { Metadata } from "next";
import ZApp from "@/components/z/ZApp";

/* /z — Z худалдааны ментор (2026-11-03, 11-04). Логик: lib/z/agent.ts, санах ой: lib/z/vectors.ts, API: /api/z. */
export const metadata: Metadata = {
  title: "Z · Худалдааны ментор — Antaqor",
  description: "Онлайн худалдаа, борлуулалт дээр тоон дээр тулгуурлаж шударга зөвлөдөг, яриагаа санаж явдаг AI ментор.",
  robots: { index: false },
};

export default function ZPage() {
  return <ZApp />;
}
