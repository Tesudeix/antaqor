import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import dbConnect from "./mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import { ThreadsAPI } from "./threads";

export const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com", "cyberempire4444@gmail.com"];

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const email = session.user.email?.toLowerCase() || "";

  // Super admins (hardcoded) always pass
  if (SUPER_ADMIN_EMAILS.includes(email)) return session;

  // Check DB role for dynamic admins
  await dbConnect();
  const User = (await import("@/models/User")).default;
  const user = await User.findOne({ email }).select("role").lean();
  if (user && user.role === "admin") return session;

  return null;
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

// Refresh an expired token in place. Failure contract: if the refresh fails,
// the account is marked "reconnect_needed" and the engine skips it (its
// automations are effectively paused) until the admin re-authenticates.
async function ensureFreshToken(token: InstanceType<typeof ThreadsToken>): Promise<boolean> {
  if (token.expiresAt >= new Date()) return true;
  try {
    const refreshed = await ThreadsAPI.refreshToken(token.accessToken);
    if (refreshed.access_token) {
      token.accessToken = refreshed.access_token;
      token.expiresAt = new Date(Date.now() + (refreshed.expires_in || 5184000) * 1000);
      token.status = "active";
      await token.save();
      return true;
    }
  } catch {
    /* fall through to reconnect_needed */
  }
  token.status = "reconnect_needed";
  await token.save();
  return false;
}

export async function getThreadsClient(threadsUserId?: string): Promise<ThreadsAPI | null> {
  await dbConnect();
  const query = threadsUserId ? { threadsUserId } : {};
  const token = await ThreadsToken.findOne(query).sort({ updatedAt: -1 });
  if (!token && threadsUserId) return tenantThreadsClient(threadsUserId);
  if (!token) return null;
  if (!(await ensureFreshToken(token))) return null;
  return new ThreadsAPI(token.accessToken, token.threadsUserId);
}

/* Antaqor Agent-ийн түрээслэгчийн Threads (AgentConn) — зөвхөн threadsUserId-аар, нийтлэгчид.
   Эзний ThreadsToken жагсаалт, бот, инсайтад хэзээ ч орохгүй. */
async function tenantThreadsClient(threadsUserId: string): Promise<ThreadsAPI | null> {
  const { AgentConn } = await import("@/models/AgentWorkspace");
  const c = await AgentConn.findOne({ platform: "threads", threadsUserId }).select("+accessToken expiresAt status");
  if (!c?.accessToken || c.status === "reconnect_needed") return null;
  if (c.expiresAt && c.expiresAt < new Date(Date.now() + 3 * 864e5)) {
    try {
      const r = await ThreadsAPI.refreshToken(c.accessToken);
      if (r.access_token) { c.accessToken = r.access_token; c.expiresAt = new Date(Date.now() + (r.expires_in || 5184000) * 1000); await c.save(); }
      else if (c.expiresAt < new Date()) { c.status = "reconnect_needed"; await c.save(); return null; }
    } catch { if (c.expiresAt < new Date()) { c.status = "reconnect_needed"; await c.save(); return null; } }
  }
  return new ThreadsAPI(c.accessToken, threadsUserId);
}

// All connected accounts with a usable (refreshed) token — the engine loops these.
export async function getThreadsAccounts() {
  await dbConnect();
  const tokens = await ThreadsToken.find({}).sort({ createdAt: 1 });
  const accounts: { token: InstanceType<typeof ThreadsToken>; client: ThreadsAPI }[] = [];
  for (const token of tokens) {
    if (token.status === "reconnect_needed") continue;
    if (!(await ensureFreshToken(token))) continue;
    accounts.push({ token, client: new ThreadsAPI(token.accessToken, token.threadsUserId) });
  }
  return accounts;
}
