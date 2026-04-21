import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";
import dbConnect from "./mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import { ThreadsAPI } from "./threads";

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

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

export async function getThreadsClient(): Promise<ThreadsAPI | null> {
  await dbConnect();
  const token = await ThreadsToken.findOne({}).sort({ updatedAt: -1 });
  if (!token) return null;

  if (token.expiresAt < new Date()) {
    try {
      const refreshed = await ThreadsAPI.refreshToken(token.accessToken);
      if (refreshed.access_token) {
        token.accessToken = refreshed.access_token;
        token.expiresAt = new Date(
          Date.now() + (refreshed.expires_in || 5184000) * 1000
        );
        await token.save();
      } else {
        return null;
      }
    } catch {
      return null;
    }
  }

  return new ThreadsAPI(token.accessToken, token.threadsUserId);
}
