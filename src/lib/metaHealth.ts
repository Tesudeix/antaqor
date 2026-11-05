// Connection health for every Meta account we send through.
//
// Written after a day where three separate outages all had the same shape: a
// token had quietly stopped working and nothing surfaced it. A page token can
// report expires_at: 0 ("never") and still go dark, because Meta's real limit
// is data_access_expires_at — a 90-day window that closes silently. This module
// is the single place that answers "is each page actually able to send right
// now, and when does it stop?".
import dbConnect from "@/lib/mongodb";
import MetaPage from "@/models/MetaPage";
import MetaTrigger from "@/models/MetaTrigger";
import MetaConversation from "@/models/MetaConversation";

const FB = "https://graph.facebook.com/v21.0";
const WINDOW_MS = 24 * 60 * 60 * 1000;

// The scopes each capability actually needs, so the UI can say WHICH feature is
// broken rather than dumping a raw scope list.
export const CAPABILITIES: { key: string; label: string; scopes: string[] }[] = [
  { key: "dm", label: "DM илгээх", scopes: ["pages_messaging"] },
  { key: "comment", label: "Сэтгэгдэл хүлээж авах", scopes: ["pages_read_engagement"] },
  { key: "commentReply", label: "Сэтгэгдэлд ил хариулах", scopes: ["pages_manage_engagement"] },
  { key: "publish", label: "Пост нийтлэх", scopes: ["pages_manage_posts"] },
  { key: "igPublish", label: "Instagram нийтлэх", scopes: ["instagram_content_publish"] },
];

export interface AccountHealth {
  key: string;
  label: string;
  pageId: string;
  igBusinessId: string;
  source: "registry" | "env";
  hasToken: boolean;
  valid: boolean;
  error: string;
  expiresAt: number | null;          // 0 = never
  dataAccessExpiresAt: number | null;
  daysLeft: number | null;           // until data access closes
  scopes: string[];
  capabilities: { key: string; label: string; ok: boolean; missing: string[] }[];
  webhookOk: boolean;
  triggers: number;
  conversations: number;
  broadcastReach: number;            // people reachable in the 24h window
}

async function gj(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    const r = await fetch(url, init);
    return (await r.json()) as Record<string, unknown>;
  } catch (e) {
    return { error: { message: String(e) } };
  }
}

async function appToken(): Promise<string> {
  const id = process.env.META_FB_APP_ID || "";
  const sec = process.env.META_FB_APP_SECRET || "";
  if (!id || !sec) return "";
  const r = await gj(`${FB}/oauth/access_token?client_id=${id}&client_secret=${sec}&grant_type=client_credentials`);
  return (r.access_token as string) || "";
}

/** Every account we could send as: the three legacy env pages + the registry. */
async function listAccounts(): Promise<Array<{
  key: string; label: string; pageId: string; igBusinessId: string; token: string; source: "registry" | "env";
}>> {
  await dbConnect();
  const rows = await MetaPage.find({ enabled: true })
    .select("key pageId name igBusinessId pageAccessToken")
    .lean<Array<{ key: string; pageId: string; name?: string; igBusinessId?: string; pageAccessToken?: string }>>();

  type Acct = { key: string; label: string; pageId: string; igBusinessId: string; token: string; source: "registry" | "env" };
  const out: Acct[] = rows.map((r) => ({
    key: r.key,
    label: r.name || r.pageId,
    pageId: r.pageId,
    igBusinessId: r.igBusinessId || "",
    token: r.pageAccessToken || "",
    source: "registry" as const,
  }));

  const seen = new Set(out.map((o) => o.key));
  const legacy = [
    { key: "antaqor", label: "Antaqor", pageId: process.env.META_PAGE_ID || "", ig: process.env.META_IG_BUSINESS_ID || "", token: process.env.FB_PAGE_ACCESS_TOKEN || "" },
    { key: "joymassage", label: "JOY massage", pageId: process.env.JOYMASSAGE_PAGE_ID || "", ig: process.env.JOYMASSAGE_IG_BUSINESS_ID || "", token: process.env.JOYMASSAGE_PAGE_ACCESS_TOKEN || "" },
    { key: "joybilliard", label: "Joy billiard", pageId: process.env.JOYBILLIARD_PAGE_ID || "", ig: process.env.JOYBILLIARD_IG_BUSINESS_ID || "", token: process.env.JOYBILLIARD_PAGE_ACCESS_TOKEN || "" },
  ];
  for (const l of legacy) {
    if (seen.has(l.key)) continue;
    out.push({ key: l.key, label: l.label, pageId: l.pageId, igBusinessId: l.ig, token: l.token, source: "env" as const });
  }
  return out;
}

export async function accountHealth(): Promise<AccountHealth[]> {
  const accounts = await listAccounts();
  const app = await appToken();
  const now = Date.now();

  return Promise.all(accounts.map(async (a): Promise<AccountHealth> => {
    const base: AccountHealth = {
      key: a.key, label: a.label, pageId: a.pageId, igBusinessId: a.igBusinessId, source: a.source,
      hasToken: Boolean(a.token), valid: false, error: a.token ? "" : "Token байхгүй",
      expiresAt: null, dataAccessExpiresAt: null, daysLeft: null, scopes: [],
      capabilities: CAPABILITIES.map((c) => ({ key: c.key, label: c.label, ok: false, missing: c.scopes })),
      webhookOk: false, triggers: 0, conversations: 0, broadcastReach: 0,
    };

    // DB-side numbers are always available, even when the token is dead.
    const accountQuery = a.key === "antaqor" ? { $in: ["antaqor", null] } : a.key;
    const [triggers, conversations, reach] = await Promise.all([
      MetaTrigger.countDocuments({ account: accountQuery, enabled: true }),
      MetaConversation.countDocuments({ account: accountQuery }),
      MetaConversation.countDocuments({
        account: accountQuery, status: "open",
        lastInboundAt: { $gte: new Date(now - WINDOW_MS) },
        broadcastOptOut: { $ne: true }, escalatedToHuman: { $ne: true }, aiDisabled: { $ne: true },
      }),
    ]);
    base.triggers = triggers;
    base.conversations = conversations;
    base.broadcastReach = reach;

    if (!a.token || !app) return base;

    const dbg = await gj(`${FB}/debug_token?input_token=${encodeURIComponent(a.token)}&access_token=${encodeURIComponent(app)}`);
    const d = (dbg.data || {}) as Record<string, unknown>;
    base.valid = d.is_valid === true;
    base.error = ((d.error as Record<string, unknown>)?.message as string) || "";
    base.expiresAt = typeof d.expires_at === "number" ? d.expires_at : null;
    base.dataAccessExpiresAt = typeof d.data_access_expires_at === "number" ? d.data_access_expires_at : null;
    if (base.dataAccessExpiresAt) {
      base.daysLeft = Math.floor((base.dataAccessExpiresAt * 1000 - now) / 86_400_000);
    }
    const scopes = Array.isArray(d.scopes) ? (d.scopes as string[]) : [];
    base.scopes = scopes;
    base.capabilities = CAPABILITIES.map((c) => {
      const missing = c.scopes.filter((sc) => !scopes.includes(sc));
      return { key: c.key, label: c.label, ok: base.valid && missing.length === 0, missing };
    });

    if (base.valid && a.pageId) {
      const subs = await gj(`${FB}/${a.pageId}/subscribed_apps?access_token=${encodeURIComponent(a.token)}`);
      const data = subs.data as Array<Record<string, unknown>> | undefined;
      base.webhookOk = Array.isArray(data) && data.some((x) => x.id === process.env.META_FB_APP_ID);
    }
    return base;
  }));
}

/** Accounts that need attention, worst first — used by the alert cron. */
export function problems(list: AccountHealth[], warnDays = 7): AccountHealth[] {
  return list
    .filter((h) => !h.valid || !h.webhookOk || (h.daysLeft !== null && h.daysLeft <= warnDays))
    .sort((a, b) => (a.valid === b.valid ? (a.daysLeft ?? 999) - (b.daysLeft ?? 999) : a.valid ? 1 : -1));
}
