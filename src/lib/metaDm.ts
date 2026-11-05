// Send a DM via Meta's Send API.
// Supports plain text, quick-reply buttons, and outside-24h message tags.

import { pageTokenFor, igTokenFor, ensurePageRegistry } from "@/lib/metaAccounts";

const IG_BASE = "https://graph.instagram.com/v23.0";
const FB_BASE = "https://graph.facebook.com/v21.0";

export type MetaPlatform = "instagram" | "messenger";

export interface QuickReply {
  label: string;   // max 20 chars
  payload: string; // returned in webhook postback
}

export interface SendDmOptions {
  account?: string;
  quickReplies?: QuickReply[];
  messageTag?: "STANDARD" | "ACCOUNT_UPDATE" | "CONFIRMED_EVENT_UPDATE" | "POST_PURCHASE_UPDATE";
}

export async function sendDm(
  platform: MetaPlatform,
  recipientId: string,
  text: string,
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  // Warm the MetaPage registry before any token lookup. ensurePageRegistry
  // was only ever called from the webhook, so in every OTHER context —
  // broadcast, nurture, the scheduler, an admin action — the in-memory
  // registry was empty and pageTokenFor() fell through to
  // FB_PAGE_ACCESS_TOKEN, the dead Antaqor token. Every registry-connected
  // tenant silently sent as a logged-out Antaqor. Cached 30s, so free here.
  await ensurePageRegistry();
  let token: string | undefined;
  let url: string;

  if (platform === "instagram") {
    token = igTokenFor(opts.account || "antaqor");
    const base = token?.startsWith("IGAA") ? IG_BASE : FB_BASE;
    url = `${base}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  } else {
    token = pageTokenFor(opts.account || "antaqor");
    url = `${FB_BASE}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  }

  if (!token) {
    return { ok: false, status: 500, body: `missing ${platform} access token` };
  }

  type MessageObj = {
    text: string;
    quick_replies?: Array<{ content_type: "text"; title: string; payload: string }>;
  };
  const message: MessageObj = { text: text.slice(0, 1000) };

  if (opts.quickReplies && opts.quickReplies.length > 0) {
    message.quick_replies = opts.quickReplies.slice(0, 13).map((qr) => ({
      content_type: "text",
      title: qr.label.slice(0, 20),
      payload: qr.payload.slice(0, 1000),
    }));
  }

  const isOutside24h = opts.messageTag && opts.messageTag !== "STANDARD";
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message,
    messaging_type: isOutside24h ? "MESSAGE_TAG" : "RESPONSE",
    ...(isOutside24h ? { tag: opts.messageTag } : {}),
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}


export interface LinkButton { label: string; url: string }

function normalizeButtonUrl(u?: string): string | null {
  const s = (u || "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  // Root-relative upload paths (/uploads/x.webp) → absolute site origin.
  // /api/upload returns a relative URL; without this the old "https://"+s
  // branch produced "https:///uploads/..." (empty host) and Meta could not
  // fetch the image, so flow-card images silently never rendered in DMs.
  if (s.startsWith("/")) {
    const base = (process.env.NEXTAUTH_URL || "https://antaqor.com").replace(/\/$/, "");
    return base + s;
  }
  const dot = s.indexOf(".");
  if (dot > 0 && dot < s.length - 2 && !s.includes(" ")) return "https://" + s;
  return null;
}

// Messenger/IG button template: a text bubble with up to 3 web_url buttons.
export async function sendButtonTemplate(
  platform: MetaPlatform,
  recipientId: string,
  text: string,
  buttons: LinkButton[],
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensurePageRegistry();
  let token: string | undefined;
  let url: string;
  if (platform === "instagram") {
    token = igTokenFor(opts.account || "antaqor");
    const base = token?.startsWith("IGAA") ? IG_BASE : FB_BASE;
    url = `${base}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  } else {
    token = pageTokenFor(opts.account || "antaqor");
    url = `${FB_BASE}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  }
  if (!token) return { ok: false, status: 500, body: `missing ${platform} access token` };

  const tpl = buttons
    .map((b) => ({ label: b.label, url: normalizeButtonUrl(b.url) }))
    .filter((b) => b.label && b.url)
    .slice(0, 3)
    .map((b) => ({ type: "web_url", url: b.url as string, title: b.label.slice(0, 20) }));
  if (tpl.length === 0) return sendDm(platform, recipientId, text, opts);

  const isOutside24h = opts.messageTag && opts.messageTag !== "STANDARD";
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { attachment: { type: "template", payload: { template_type: "button", text: text.slice(0, 640), buttons: tpl } } },
    messaging_type: isOutside24h ? "MESSAGE_TAG" : "RESPONSE",
    ...(isOutside24h ? { tag: opts.messageTag } : {}),
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}

// Generic template = a carousel of image cards (image + title + subtitle + up to 3 link buttons).
export interface CardButton { label: string; url: string; }
export interface MessageCard { imageUrl?: string; title: string; subtitle?: string; buttons?: CardButton[]; }

export async function sendGenericTemplate(
  platform: MetaPlatform,
  recipientId: string,
  cards: MessageCard[],
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensurePageRegistry();
  let token: string | undefined;
  let url: string;
  if (platform === "instagram") {
    token = igTokenFor(opts.account || "antaqor");
    const base = token?.startsWith("IGAA") ? IG_BASE : FB_BASE;
    url = `${base}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  } else {
    token = pageTokenFor(opts.account || "antaqor");
    url = `${FB_BASE}/me/messages?access_token=${encodeURIComponent(token || "")}`;
  }
  if (!token) return { ok: false, status: 500, body: `missing ${platform} access token` };

  const elements = cards
    .filter((c) => c.title && c.title.trim())
    .slice(0, 10)
    .map((c) => {
      const img = normalizeButtonUrl(c.imageUrl);
      const buttons = (c.buttons || [])
        .map((b) => ({ label: b.label, url: normalizeButtonUrl(b.url) }))
        .filter((b) => b.label && b.url)
        .slice(0, 3)
        .map((b) => ({ type: "web_url", url: b.url as string, title: b.label.slice(0, 20) }));
      const el: Record<string, unknown> = { title: c.title.slice(0, 80) };
      if (c.subtitle) el.subtitle = c.subtitle.slice(0, 80);
      if (img) el.image_url = img;
      if (buttons.length) {
        el.buttons = buttons;
        el.default_action = { type: "web_url", url: buttons[0].url };
      }
      return el;
    });
  if (elements.length === 0) return { ok: false, status: 400, body: "no valid cards" };

  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { attachment: { type: "template", payload: { template_type: "generic", elements } } },
    messaging_type: "RESPONSE",
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}

// ─────────────────────────────────────────────────────────────────────────
// Flow Builder runtime senders
// A flow card is one message bubble: optional image, text, and up to 3
// buttons. Buttons can jump to another card / fire an action (postback) or
// open a link (web_url) — so the button template carries MIXED button types,
// unlike sendButtonTemplate above which is web_url-only.
// ─────────────────────────────────────────────────────────────────────────

export type FlowSendButton =
  | { type: "postback"; label: string; payload: string }
  | { type: "url"; label: string; url: string };

function resolveSend(platform: MetaPlatform, account?: string): { url: string; token?: string } {
  if (platform === "instagram") {
    const token = igTokenFor(account || "antaqor");
    const base = token?.startsWith("IGAA") ? IG_BASE : FB_BASE;
    return { url: `${base}/me/messages?access_token=${encodeURIComponent(token || "")}`, token };
  }
  const token = pageTokenFor(account || "antaqor");
  return { url: `${FB_BASE}/me/messages?access_token=${encodeURIComponent(token || "")}`, token };
}

// Send a standalone image attachment (used before a card's text when it has an image).
export async function sendImageAttachment(
  platform: MetaPlatform,
  recipientId: string,
  imageUrl: string,
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensurePageRegistry();
  const { url, token } = resolveSend(platform, opts.account);
  if (!token) return { ok: false, status: 500, body: `missing ${platform} access token` };
  const img = normalizeButtonUrl(imageUrl);
  if (!img) return { ok: false, status: 400, body: "invalid image url" };
  const isOutside24h = opts.messageTag && opts.messageTag !== "STANDARD";
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { attachment: { type: "image", payload: { url: img, is_reusable: true } } },
    messaging_type: isOutside24h ? "MESSAGE_TAG" : "RESPONSE",
    ...(isOutside24h ? { tag: opts.messageTag } : {}),
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}

// Send 2–10 Flow Builder cards as a single horizontal-scroll carousel (generic template).
// Each element supports mixed postback + web_url buttons.
// Falls back to sendFlowCard when only one card is provided.
export async function sendFlowCarousel(
  platform: MetaPlatform,
  recipientId: string,
  cards: Array<{ text: string; imageUrl?: string; subtitle?: string; buttons: FlowSendButton[] }>,
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensurePageRegistry();
  if (cards.length <= 1) return sendFlowCard(platform, recipientId, cards[0] ?? { text: "—", buttons: [] }, opts);
  const { url, token } = resolveSend(platform, opts.account);
  if (!token) return { ok: false, status: 500, body: `missing ${platform} access token` };

  const elements = cards.slice(0, 10).map((card) => {
    const title = (card.text || card.subtitle || "—").slice(0, 80);
    const img = card.imageUrl ? normalizeButtonUrl(card.imageUrl) : null;
    const buttons = card.buttons
      .map((b) =>
        b.type === "url"
          ? { type: "web_url", url: normalizeButtonUrl(b.url), title: b.label.slice(0, 20) }
          : { type: "postback", title: b.label.slice(0, 20), payload: b.payload.slice(0, 1000) }
      )
      .filter((b) => (b.type === "web_url" ? !!b.url : true) && b.title)
      .slice(0, 3);
    const el: Record<string, unknown> = { title };
    if (card.subtitle?.trim()) el.subtitle = card.subtitle.slice(0, 80);
    if (img) el.image_url = img;
    if (buttons.length) el.buttons = buttons;
    return el;
  });

  const isOutside24h = opts.messageTag && opts.messageTag !== "STANDARD";
  const body = JSON.stringify({
    recipient: { id: recipientId },
    // image_aspect_ratio:"square" — Meta's generic-template carousel ONLY supports
    // "square"(1:1) or "horizontal"(1.91:1). Without it Meta defaults to 1.91:1 and
    // center-crops portrait product/food photos (heads/dishes cut off). Square is the
    // closest non-destructive option for the upright product shots MN shops upload.
    message: { attachment: { type: "template", payload: { template_type: "generic", image_aspect_ratio: "square", elements } } },
    messaging_type: isOutside24h ? "MESSAGE_TAG" : "RESPONSE",
    ...(isOutside24h ? { tag: opts.messageTag } : {}),
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}

// Send one Flow Builder card. Image (if any) goes first as its own bubble,
// then the text + buttons. With no buttons it's a plain text bubble (branch end).
export async function sendFlowCard(
  platform: MetaPlatform,
  recipientId: string,
  card: { text: string; imageUrl?: string; subtitle?: string; buttons: FlowSendButton[] },
  opts: SendDmOptions = {}
): Promise<{ ok: boolean; status: number; body: string }> {
  await ensurePageRegistry();
  const { url, token } = resolveSend(platform, opts.account);
  if (!token) return { ok: false, status: 500, body: `missing ${platform} access token` };

  if (card.imageUrl && normalizeButtonUrl(card.imageUrl)) {
    await sendImageAttachment(platform, recipientId, card.imageUrl, opts).catch(() => {});
  }

  const text = (card.text || card.subtitle || "—").slice(0, 640);
  const tplButtons = card.buttons
    .map((b) =>
      b.type === "url"
        ? { type: "web_url", url: normalizeButtonUrl(b.url), title: b.label.slice(0, 20) }
        : { type: "postback", title: b.label.slice(0, 20), payload: b.payload.slice(0, 1000) }
    )
    .filter((b) => (b.type === "web_url" ? !!b.url : true) && b.title)
    .slice(0, 3);

  // No usable buttons → plain text bubble (end of a branch). sendDm already
  // honours opts.messageTag for the outside-24h window.
  if (tplButtons.length === 0) return sendDm(platform, recipientId, text, opts);

  const isOutside24h = opts.messageTag && opts.messageTag !== "STANDARD";
  const body = JSON.stringify({
    recipient: { id: recipientId },
    message: { attachment: { type: "template", payload: { template_type: "button", text, buttons: tplButtons } } },
    messaging_type: isOutside24h ? "MESSAGE_TAG" : "RESPONSE",
    ...(isOutside24h ? { tag: opts.messageTag } : {}),
  });
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  const respText = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, body: respText };
}
