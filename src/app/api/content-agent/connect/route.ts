import { NextRequest, NextResponse } from "next/server";
import { wsContext, MAIN } from "@/lib/agentWs";
import { signState, META_SCOPES, META_PUBLISH_SCOPES, metaAppCredentials, metaPublicOrigin, metaRedirectUri } from "@/lib/metaOAuth";

/* Antaqor Agent — «Холбох» товч: ?p=meta | threads → тухайн платформын нэвтрэх цонх.
   Буцаж ирэхэд хэрэглэгч /content-agent?v=connect дээр гарч, хуудсаа сонгоно.
   Эзэн ("main") Meta-д хуучин бүрэн эрхийг (DM бот орно) авна; түрээслэгч зөвхөн нийтлэх эрх. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const c = await wsContext(req);
  const origin = metaPublicOrigin(req.nextUrl.origin);
  if (!c) return NextResponse.redirect(`${origin}/auth/signin?callbackUrl=${encodeURIComponent("/content-agent")}`);
  if (!c.ws) return NextResponse.redirect(`${origin}/content-agent`);
  const p = req.nextUrl.searchParams.get("p");
  const ret = `/content-agent?v=connect${c.viewingAs ? `&as=${c.ws}` : ""}`;

  if (p === "meta") {
    const { appId } = metaAppCredentials("default");
    if (!appId) return NextResponse.redirect(`${origin}${ret}&meta=${encodeURIComponent("Meta апп тохируулаагүй")}`);
    const state = signState({ email: c.email, origin, ts: Date.now(), appKey: "default", ret, ws: c.ws });
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", metaRedirectUri());
    url.searchParams.set("scope", (c.ws === MAIN ? META_SCOPES : META_PUBLISH_SCOPES).join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }
  if (p === "threads") {
    const appId = process.env.THREADS_APP_ID, redirect = process.env.THREADS_REDIRECT_URI;
    if (!appId || !redirect) return NextResponse.redirect(`${origin}${ret}&threads=${encodeURIComponent("Threads апп тохируулаагүй")}`);
    const state = signState({ email: c.email, origin, ts: Date.now(), kind: "threads", uid: c.userId, ws: c.ws, ret });
    const url = new URL("https://threads.net/oauth/authorize");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirect);
    /* эзэн: админы урсгалтай ИЖИЛ эрх (хариултын автомат ажиллахгүй болохоос сэргийлнэ) */
    url.searchParams.set("scope", c.ws === MAIN ? "threads_basic,threads_content_publish,threads_delete,threads_manage_replies,threads_read_replies,threads_manage_insights" : "threads_basic,threads_content_publish,threads_manage_insights");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  }
  return NextResponse.redirect(`${origin}${ret}`);
}
