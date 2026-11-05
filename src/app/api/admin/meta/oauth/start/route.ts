import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import {
  signState,
  META_SCOPES,
  metaAppCredentials,
  metaPublicOrigin,
  metaRedirectUri,
} from "@/lib/metaOAuth";

export const dynamic = "force-dynamic";

// Step 1 of "connect Facebook + Instagram in one click".
// The callback runs on a fixed host (the whitelisted redirect URI) which may
// differ from the host the admin is browsing, so the session cannot be relied
// on there — we carry a signed state instead and verify it on return.
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const requestedApp = req.nextUrl.searchParams.get("app") || "default";
  const { appId, appKey } = metaAppCredentials(requestedApp);
  if (!appId) {
    return NextResponse.json({ error: `Meta App (${appKey}) тохируулаагүй байна.` }, { status: 500 });
  }

  const origin = metaPublicOrigin(req.nextUrl.origin);
  const state = signState({ email: session.user?.email || "", origin, ts: Date.now(), appKey });

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", metaRedirectUri());
  /* ?extended=1 — өрсөлдөгчийн IG (Business Discovery) + өөрийн reach/saves.
     Үндсэн холболтыг эвдэхгүйн тулд зөвхөн хүссэн үед нэмнэ. */
  const scopes = req.nextUrl.searchParams.get("extended") === "1" ? [...META_SCOPES, "instagram_manage_insights", "read_insights"] : META_SCOPES;
  url.searchParams.set("scope", scopes.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
