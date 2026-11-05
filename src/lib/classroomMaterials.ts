// Хичээлд хавсаргах материалын цэвэрлэгээ — хоёр lessons route нэг л
// дүрмийг ашиглана. `javascript:` зэрэг схемийг татгалзана: href болж
// хэрэглэгчийн хөтөч дээр ажиллах учир.
export type MaterialKind = "file" | "link";
export interface Material { url: string; name: string; size?: number; kind?: MaterialKind }

export const MAX_MATERIALS = 20;

export function sanitizeMaterials(input: unknown): Material[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const out: Material[] = [];
  for (const raw of input) {
    const a = raw as { url?: unknown; name?: unknown; size?: unknown; kind?: unknown };
    if (typeof a?.url !== "string" || typeof a?.name !== "string") continue;
    const url = a.url.trim();
    const name = a.name.trim().slice(0, 200);
    if (!url || !name || url.length > 2000) continue;
    const local = url.startsWith("/uploads/") && !url.includes("..");
    const remote = /^https?:\/\//i.test(url);
    if (!local && !remote) continue;
    out.push({
      url,
      name,
      size: typeof a.size === "number" && a.size >= 0 ? a.size : undefined,
      kind: a.kind === "file" || a.kind === "link" ? a.kind : local ? "file" : "link",
    });
    if (out.length >= MAX_MATERIALS) break;
  }
  return out;
}
