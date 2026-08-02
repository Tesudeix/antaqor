// Server-side WebAuthn helpers — wraps @simplewebauthn/server with Antaqor
// defaults (rpID, origin, challenge cookie name).

import { cookies } from "next/headers";

// Relying Party — must match the registrable domain, not a path.
//   Production: antaqor.com
//   Local dev:  localhost
export function getRPID(): string {
  return process.env.WEBAUTHN_RP_ID || "antaqor.com";
}

export function getRPName(): string {
  return process.env.WEBAUTHN_RP_NAME || "Antaqor";
}

// Allowed origins for assertion verification. Multiple lets you support
// the apex + www in production; in dev we accept localhost too.
export function getExpectedOrigins(): string[] {
  const env = process.env.WEBAUTHN_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  const rp = getRPID();
  if (rp === "localhost") return ["http://localhost:3000"];
  return [`https://${rp}`, `https://www.${rp}`];
}

const CHALLENGE_COOKIE = "antaqor_webauthn_chal";

export async function setChallenge(challenge: string) {
  const c = await cookies();
  c.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 5 * 60, // 5 minutes — challenge must be redeemed soon
    path: "/",
  });
}

export async function readChallenge(): Promise<string | null> {
  const c = await cookies();
  return c.get(CHALLENGE_COOKIE)?.value || null;
}

export async function clearChallenge() {
  const c = await cookies();
  c.delete(CHALLENGE_COOKIE);
}
