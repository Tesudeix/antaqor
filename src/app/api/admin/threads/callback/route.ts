import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { ThreadsAPI } from "@/lib/threads";
import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";

const BASE = process.env.NEXTAUTH_URL || "https://tesudeix.com";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(`${BASE}/auth/signin`);
  }

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    const errorDesc =
      req.nextUrl.searchParams.get("error_description") || "Authorization failed";
    return NextResponse.redirect(
      `${BASE}/admin?error=${encodeURIComponent(errorDesc)}`
    );
  }

  try {
    const appId = process.env.THREADS_APP_ID!;
    const appSecret = process.env.THREADS_APP_SECRET!;
    const redirectUri = process.env.THREADS_REDIRECT_URI!;

    const shortLived = await ThreadsAPI.exchangeCodeForToken(
      code,
      appId,
      appSecret,
      redirectUri
    );

    if (shortLived.error) {
      throw new Error(shortLived.error_message || shortLived.error.message);
    }

    const longLived = await ThreadsAPI.exchangeForLongLivedToken(
      shortLived.access_token,
      appSecret
    );

    if (longLived.error) {
      throw new Error(longLived.error_message || longLived.error.message);
    }

    await dbConnect();

    const userId = (session.user as { id: string }).id;

    await ThreadsToken.findOneAndUpdate(
      { userId },
      {
        userId,
        threadsUserId: shortLived.user_id,
        accessToken: longLived.access_token,
        tokenType: longLived.token_type || "bearer",
        expiresAt: new Date(
          Date.now() + (longLived.expires_in || 5184000) * 1000
        ),
      },
      { upsert: true, new: true }
    );

    return NextResponse.redirect(`${BASE}/admin?connected=true`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      `${BASE}/admin?error=${encodeURIComponent(msg)}`
    );
  }
}
