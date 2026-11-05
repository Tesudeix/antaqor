import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import MetaOAuthToken from "@/models/MetaOAuthToken";
import { metaAppCredentials, verifyState, metaRedirectUri, agentReturn } from "@/lib/metaOAuth";

export const dynamic = "force-dynamic";

const FB = "https://graph.facebook.com/v21.0";

// Step 2: swap the code for a LONG-LIVED user token and park it. The admin
// then picks Pages on /admin/social, and each pick mints a permanent page
// token (see /api/admin/social/meta-connect).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const state = verifyState(sp.get("state") || "");
  const back = (msg: string) => {
    const origin = state?.origin || req.nextUrl.origin;
    const ret = agentReturn(state?.ret);
    if (ret) return NextResponse.redirect(`${origin}${ret}${ret.includes("?") ? "&" : "?"}meta=${encodeURIComponent(msg)}`);
    return NextResponse.redirect(`${origin}/admin/connections?meta=${encodeURIComponent(msg)}`);
  };

  if (!state) return back("state-invalid");
  if (sp.get("error")) return back(sp.get("error_description") || sp.get("error") || "denied");

  const code = sp.get("code") || "";
  if (!code) return back("no-code");

  const { appId, appSecret } = metaAppCredentials(state.appKey);
  if (!appId || !appSecret) return back("app-credentials-missing");

  const tokenRes = await fetch(
    `${FB}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(metaRedirectUri())}&code=${encodeURIComponent(code)}`
  ).then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => ({}) as Record<string, unknown>);

  const shortToken = String(tokenRes.access_token || "");
  if (!shortToken) {
    const e = tokenRes.error as Record<string, unknown> | undefined;
    return back(String(e?.message || "token-exchange-failed"));
  }

  // Short-lived (~1h) → long-lived (~60d). Page tokens derived from a
  // long-lived user token never expire, which is what we actually want.
  const longRes = await fetch(
    `${FB}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`
  ).then((r) => r.json() as Promise<Record<string, unknown>>).catch(() => ({}) as Record<string, unknown>);

  const userToken = String(longRes.access_token || shortToken);
  const expiresIn = Number(longRes.expires_in || 60 * 24 * 3600);

  await dbConnect();
  await MetaOAuthToken.findOneAndUpdate(
    { email: state.email },
    { email: state.email, userToken, expiresAt: new Date(Date.now() + expiresIn * 1000) },
    { upsert: true }
  );

  return back("ok");
}
