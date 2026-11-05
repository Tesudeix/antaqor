// Shared bits of the Facebook Login round-trip used by /admin/social.
import crypto from "crypto";

// Publishing + the messaging scopes the existing automation already relies on,
// so one connect covers posting AND the DM/comment funnels.
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_metadata",
  "pages_manage_engagement",
  "pages_messaging",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_messages",
  "business_management",
];

// Must be byte-identical to a "Valid OAuth Redirect URI" in the Meta app
// (Facebook Login → Settings), otherwise Meta rejects with error 191.
export function metaRedirectUri(): string {
  return process.env.META_OAUTH_REDIRECT_URI || "https://antaqor.com/api/admin/meta/oauth/callback";
}

export type MetaAppKey = "default" | "reva";

/* ret/ws — Antaqor Agent (/content-agent)-аас эхэлсэн холболт: буцах зам ба workspace.
   kind/uid — Threads-ийн агент урсгал (callback админ session шаардахгүй, гарын үсэг л). */
type StatePayload = { email: string; origin: string; ts: number; appKey?: MetaAppKey; ret?: string; ws?: string; kind?: "threads"; uid?: string };
/** Зөвхөн /content-agent доторх зам руу буцаана (open redirect хаалттай) */
export function agentReturn(ret?: string): string { return ret && /^\/content-agent(\?|$)/.test(ret) ? ret : ""; }
/** Агентаас холбоход хэрэгтэй хамгийн бага эрх — нийтлэх л (DM/бот эрхгүй, хэрэглэгчид ойлгомжтой) */
export const META_PUBLISH_SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "instagram_basic", "instagram_content_publish", "business_management"];

export function metaAppCredentials(requested?: string): {
  appKey: MetaAppKey;
  appId: string;
  appSecret: string;
} {
  if (requested === "reva") {
    return {
      appKey: "reva",
      appId: process.env.META_REVA_APP_ID || "",
      appSecret: process.env.META_REVA_APP_SECRET || "",
    };
  }

  return {
    appKey: "default",
    appId: process.env.META_FB_APP_ID || "",
    appSecret: process.env.META_FB_APP_SECRET || "",
  };
}

export function metaPublicOrigin(fallback: string): string {
  const configured = process.env.META_PUBLIC_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  try {
    return new URL(metaRedirectUri()).origin;
  } catch {
    return fallback.replace(/\/$/, "");
  }
}

function secret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.META_FB_APP_SECRET || "antaqor-meta-oauth";
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function signState(payload: StatePayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

// Valid for 15 minutes — long enough for the Meta dialog, short enough that a
// leaked URL is useless.
export function verifyState(state: string): StatePayload | null {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StatePayload;
    if (!payload.ts || Date.now() - payload.ts > 15 * 60_000) return null;
    return payload;
  } catch {
    return null;
  }
}
