import MetaPage from "@/models/MetaPage";

// A Meta account = a connected Page. The 3 legacy pages use named keys + env tokens;
// new pages are added via the DB registry (self-service) and keyed by their pageId.
export type MetaAccount = "antaqor" | "joymassage" | "joybilliard" | (string & {});

type PageRec = { key: string; pageId: string; igBusinessId: string; pageAccessToken: string };
let _registry: PageRec[] = [];
let _loadedAt = 0;

// Refresh the in-memory page registry (cached ~30s). Call before routing/sending.
export async function ensurePageRegistry(maxAgeMs = 30000): Promise<void> {
  if (_loadedAt && Date.now() - _loadedAt < maxAgeMs) return;
  try {
    const rows = await MetaPage.find({ enabled: true })
      .select("key pageId igBusinessId pageAccessToken")
      .lean<{ key: string; pageId: string; igBusinessId?: string; pageAccessToken?: string }[]>();
    _registry = rows.map((r) => ({
      key: r.key,
      pageId: r.pageId,
      igBusinessId: r.igBusinessId || "",
      pageAccessToken: r.pageAccessToken || "",
    }));
    _loadedAt = Date.now();
  } catch {
    /* keep previous cache on error */
  }
}

export function accountForPageId(pageId?: string | null): MetaAccount {
  if (!pageId) return "antaqor";
  const hit = _registry.find((r) => r.pageId === pageId || r.igBusinessId === pageId);
  if (hit) return hit.key;
  if (pageId === process.env.JOYMASSAGE_PAGE_ID || pageId === process.env.JOYMASSAGE_IG_BUSINESS_ID) return "joymassage";
  if (pageId === process.env.JOYBILLIARD_PAGE_ID || pageId === process.env.JOYBILLIARD_IG_BUSINESS_ID) return "joybilliard";
  return "antaqor";
}

export function pageTokenFor(account: MetaAccount): string {
  const hit = _registry.find((r) => r.key === account);
  if (hit && hit.pageAccessToken) return hit.pageAccessToken;
  if (account === "joymassage") return process.env.JOYMASSAGE_PAGE_ACCESS_TOKEN || "";
  if (account === "joybilliard") return process.env.JOYBILLIARD_PAGE_ACCESS_TOKEN || "";
  return process.env.FB_PAGE_ACCESS_TOKEN || "";
}

export function igTokenFor(account: MetaAccount): string {
  const hit = _registry.find((r) => r.key === account);
  if (hit && hit.pageAccessToken) return hit.pageAccessToken;
  if (account === "joymassage") return process.env.JOYMASSAGE_IG_ACCESS_TOKEN || process.env.JOYMASSAGE_PAGE_ACCESS_TOKEN || "";
  if (account === "joybilliard") return process.env.JOYBILLIARD_IG_ACCESS_TOKEN || process.env.JOYBILLIARD_PAGE_ACCESS_TOKEN || "";
  return process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "";
}

// Static labels for the 3 legacy accounts (UI fallback). Dynamic pages come from the API.
export const META_ACCOUNTS: { key: MetaAccount; label: string }[] = [
  { key: "antaqor", label: "Antaqor" },
  { key: "joymassage", label: "joymassage · @cityandjoy" },
  { key: "joybilliard", label: "Joy billiard · @joy.billiard" },
];

export function pageRegistrySnapshot(): PageRec[] {
  return _registry;
}
