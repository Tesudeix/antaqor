// Comment-side Meta APIs:
//   • sendPrivateReplyToComment — DM a commenter via Private Replies API.
//     Instagram requires `instagram_manage_messages` Advanced Access.
//     Messenger uses Pages `pages_messaging` + comment_id recipient.
//   • replyToComment — public reply on the same comment.

import { pageTokenFor, igTokenFor, type MetaAccount } from "@/lib/metaAccounts";

const IG_BASE = "https://graph.instagram.com/v23.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

export type MetaPlatform = "instagram" | "messenger";

type ApiResult = { ok: boolean; status: number; body: string };

function pickToken(platform: MetaPlatform, account: MetaAccount = "antaqor"): { token: string; base: string } | null {
  if (platform === "instagram") {
    const token = igTokenFor(account) || "";
    if (!token) return null;
    const base = token.startsWith("IGAA") ? IG_BASE : FB_BASE;
    return { token, base };
  }
  const token = pageTokenFor(account) || "";
  if (!token) return null;
  return { token, base: FB_BASE };
}

export async function sendPrivateReplyToComment(
  platform: MetaPlatform,
  commentId: string,
  text: string,
  opts: { account?: MetaAccount } = {}
): Promise<ApiResult> {
  const picked = pickToken(platform, opts.account || "antaqor");
  if (!picked) return { ok: false, status: 500, body: `missing ${platform} access token` };
  const url = `${picked.base}/me/messages?access_token=${encodeURIComponent(picked.token)}`;
  const body = JSON.stringify({
    recipient: { comment_id: commentId },
    message: { text: text.slice(0, 1000) },
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}

export async function replyToComment(
  platform: MetaPlatform,
  commentId: string,
  text: string,
  opts: { account?: MetaAccount } = {}
): Promise<ApiResult> {
  const picked = pickToken(platform, opts.account || "antaqor");
  if (!picked) return { ok: false, status: 500, body: `missing ${platform} access token` };
  const url = `${picked.base}/${encodeURIComponent(commentId)}/replies?access_token=${encodeURIComponent(picked.token)}`;
  const body = new URLSearchParams({ message: text.slice(0, 1000) }).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}
