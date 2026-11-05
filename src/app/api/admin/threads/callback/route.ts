import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { ThreadsAPI } from "@/lib/threads";
import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import { AgentConn } from "@/models/AgentWorkspace";
import { verifyState, agentReturn } from "@/lib/metaOAuth";

/* Буцах хаягийг `THREADS_REDIRECT_URI`-ийн origin-оос гаргана.
   `NEXTAUTH_URL` руу БУЦАЖ УНАХГҮЙ — 2026-09-26-нд яг тэр нь эвдсэн:
   түүний утга `https://tesudeix.com` байсан бөгөөд тэр домэйны DNS нь
   энэ droplet руу зааxгүй, TLS нь ч холбогддоггүй. OAuth өөрөө амжилттай
   болоод ЭЦСИЙН redirect нь үхсэн домэйн руу хаядаг байв.

   Redirect URI нь Threads апп дээр бүртгэгдсэн, ЗААВАЛ ажилладаг хаяг
   тул түүний origin бол хамгийн найдвартай эх сурвалж. */
function baseFromRedirect(): string {
  try {
    return new URL(process.env.THREADS_REDIRECT_URI || "").origin;
  } catch {
    return "https://antaqor.com";
  }
}
const BASE = baseFromRedirect();

/* Antaqor Agent (/content-agent)-аас эхэлсэн холболт: гарын үсэгтэй state дотор хэрэглэгч,
   workspace, буцах зам байна → админ session ШААРДАХГҮЙ. "main" → эзний ThreadsToken (хуучнаараа),
   түрээслэгч → AgentConn (эзний бот/инсайт түүнийг хэзээ ч харахгүй). */
async function agentFlow(req: NextRequest, st: { uid?: string; ws?: string; ret?: string; email: string }) {
  const ret = agentReturn(st.ret) || "/content-agent?v=connect";
  const back = (q: string) => NextResponse.redirect(`${BASE}${ret}${ret.includes("?") ? "&" : "?"}${q}`);
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return back(`threads=${encodeURIComponent(req.nextUrl.searchParams.get("error_description") || "denied")}`);
  try {
    const appSecret = process.env.THREADS_APP_SECRET!;
    const shortLived = await ThreadsAPI.exchangeCodeForToken(code, process.env.THREADS_APP_ID!, appSecret, process.env.THREADS_REDIRECT_URI!);
    if (shortLived.error) throw new Error(shortLived.error_message || shortLived.error.message);
    const longLived = await ThreadsAPI.exchangeForLongLivedToken(shortLived.access_token, appSecret);
    if (longLived.error) throw new Error(longLived.error_message || longLived.error.message);
    const me = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${longLived.access_token}`).then((r) => r.json()).catch(() => ({}));
    const threadsUserId = String(me.id || "");
    if (!threadsUserId) throw new Error("Threads аккаунт уншиж чадсангүй");
    const expiresAt = new Date(Date.now() + (longLived.expires_in || 5184000) * 1000);
    await dbConnect();
    if (!st.ws || st.ws === "main") {
      await ThreadsToken.findOneAndUpdate({ userId: st.uid }, { userId: st.uid, threadsUserId, username: String(me.username || ""), accessToken: longLived.access_token, tokenType: longLived.token_type || "bearer", expiresAt, status: "active" }, { upsert: true, new: true });
    } else {
      await AgentConn.findOneAndUpdate({ platform: "threads", key: threadsUserId }, { ws: st.ws, platform: "threads", key: threadsUserId, threadsUserId, username: String(me.username || ""), label: `@${me.username || threadsUserId}`, accessToken: longLived.access_token, expiresAt, status: "active", connectedBy: st.email }, { upsert: true, new: true });
    }
    return back("threads=ok");
  } catch (err) {
    return back(`threads=${encodeURIComponent(err instanceof Error ? err.message : "OAuth failed")}`);
  }
}

export async function GET(req: NextRequest) {
  const st = verifyState(req.nextUrl.searchParams.get("state") || "");
  if (st?.kind === "threads") return agentFlow(req, st);
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
      `${BASE}/admin/threads?error=${encodeURIComponent(errorDesc)}`
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

    // shortLived.user_id arrives as a JSON *number*, and 64-bit Threads IDs
    // overflow JS number precision (…581 parsed as …580, after which every
    // /{uid}/threads call 404s). /me returns the id as a string — use that.
    let threadsUserId = "";
    try {
      const meRes = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id&access_token=${longLived.access_token}`
      );
      const me = await meRes.json();
      if (me.id) threadsUserId = String(me.id);
    } catch {
      // fall through to the (possibly imprecise) exchange value below
    }
    if (!threadsUserId) threadsUserId = String(shortLived.user_id);

    await ThreadsToken.findOneAndUpdate(
      { userId },
      {
        userId,
        threadsUserId,
        accessToken: longLived.access_token,
        tokenType: longLived.token_type || "bearer",
        expiresAt: new Date(
          Date.now() + (longLived.expires_in || 5184000) * 1000
        ),
      },
      { upsert: true, new: true }
    );

    return NextResponse.redirect(`${BASE}/admin/threads?connected=true`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth failed";
    return NextResponse.redirect(
      `${BASE}/admin/threads?error=${encodeURIComponent(msg)}`
    );
  }
}
