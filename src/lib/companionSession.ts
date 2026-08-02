import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Resolve who's talking to Antaqor. Either a logged-in user or an anonymous
// browser-stored guest key. Guest keys are read from the X-Guest-Id header
// (the /companion page generates one in localStorage on first visit).

export type CompanionSubject =
  | { kind: "user"; userId: string }
  | { kind: "guest"; guestKey: string };

const GUEST_KEY_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export async function resolveCompanionSubject(
  req: NextRequest
): Promise<CompanionSubject | null> {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    const userId = (session.user as { id?: string }).id;
    if (userId) return { kind: "user", userId };
  }

  const guestKey = (req.headers.get("x-guest-id") || "").trim();
  if (guestKey && GUEST_KEY_RE.test(guestKey)) {
    return { kind: "guest", guestKey };
  }
  return null;
}

// Helpers to build the {user|guestKey} mongo filter consistently.
export function subjectFilter(s: CompanionSubject) {
  return s.kind === "user" ? { user: s.userId } : { guestKey: s.guestKey };
}

export function subjectInsert(s: CompanionSubject) {
  return s.kind === "user" ? { user: s.userId } : { guestKey: s.guestKey };
}

// Stable ratelimit key per subject, for the /lib/rateLimit helper.
export function subjectRateKey(s: CompanionSubject): string {
  return s.kind === "user" ? `u:${s.userId}` : `g:${s.guestKey}`;
}
