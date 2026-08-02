// ─── Safe URL validation ───
// Prevents SSRF and other URL-injection attacks on any field where we
// accept a user-provided external URL (post images, news source, market externalUrl).

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS instance metadata
  "metadata.google.internal",
  "metadata",
  "host.docker.internal",
  "::1",
]);

const BLOCKED_NET_PREFIXES = [
  "10.",
  "192.168.",
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "127.",
  "0.",
  "169.254.",
  "224.",      // multicast
  "fe80:",     // ipv6 link-local
  "fc00:",     // ipv6 ULA
  "fd00:",     // ipv6 ULA
];

export interface UrlCheck {
  ok: boolean;
  reason?: string;
  url?: URL;
}

/** Only http/https, no private IPs, no credentials, no userinfo. */
export function isSafeExternalUrl(input: string | null | undefined): UrlCheck {
  if (!input || typeof input !== "string") return { ok: false, reason: "empty" };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "protocol" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "credentials in URL" };
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: "blocked host" };
  for (const prefix of BLOCKED_NET_PREFIXES) {
    if (host.startsWith(prefix)) return { ok: false, reason: "private network" };
  }
  // IPv6 brackets allow-list — block common private ranges above already
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "private tld" };
  }

  return { ok: true, url: parsed };
}

/** Returns sanitized url string or empty string if unsafe. Non-throwing. */
export function safeExternalUrl(input: string | null | undefined): string {
  const c = isSafeExternalUrl(input);
  return c.ok && c.url ? c.url.toString() : "";
}
