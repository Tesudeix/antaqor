// Single source of truth for Mongolian Tögrög (₮) formatting.
// Brief: ₮1,000 / ₮1,500,000 — thousands separator, ₮ prefix.

export function fmtMNT(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "₮0";
  return "₮" + Math.round(n).toLocaleString("en-US");
}

// Compact form for tight tiles: ₮1.5M, ₮465K.
export function fmtMNTCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "₮0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₮${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `₮${Math.round(n / 1_000)}K`;
  return "₮" + Math.round(n).toLocaleString("en-US");
}
