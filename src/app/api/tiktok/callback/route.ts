import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAdminSession } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import TikTokConnection from "@/models/TikTokConnection";
import { TikTokAPI, TikTokError, humanError, TIKTOK_STATE_COOKIE } from "@/lib/tiktok";
import { encryptToken } from "@/lib/tokenCrypto";

export const dynamic = "force-dynamic";

// Алхам 2/2: TikTok-оос буцаж ирэх цэг.
// Бүртгэсэн Redirect URI: https://antaqor.com/api/tiktok/callback
export async function GET(req: NextRequest) {
  /* Antaqor-ийн суурь хаягийг TIKTOK_REDIRECT_URI-аас ГАРГАНА.

     Өмнө нь `process.env.NEXTAUTH_URL` байсан нь ЭВДЭРЧ БАЙВ: тэр нь
     https://tesudeix.com руу заасан бөгөөд тэр домэйн одоо энэ сервер рүү
     заахаа больсон (DNS 104.219.250.37, TLS ажиллахгүй). Үүний улмаас
     TikTok зөв буцаасан ч сүүлчийн алхам дээр хэрэглэгч үхсэн домэйн руу
     шидэгдэж байсан.

     TIKTOK_REDIRECT_URI нь TikTok порталд бүртгэгдсэнтэй ЯГ таарах ёстой
     (таарахгүй бол TikTok өөрөө татгалзана). Тиймээс түүний origin нь
     тодорхойлолтоороо энэ урсгалын зөв суурь хаяг мөн.

     NEXTAUTH_URL руу БУЦАЖ УНАХГҮЙ: чимээгүй буруу домэйн руу явснаас
     тодорхой алдаа өгсөн нь дээр. */
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json(
      { error: "TIKTOK_REDIRECT_URI is not configured" },
      { status: 500 }
    );
  }
  const BASE = new URL(redirectUri).origin;
  const HOME = `${BASE}/admin/tiktok`;

  /* `fail` нь BASE дээр хаалт үүсгэнэ — доорх дуудлагууд хэвээр. */
  const fail = (msg: string) => {
    const res = NextResponse.redirect(`${HOME}?error=${encodeURIComponent(msg)}`);
    res.cookies.delete(TIKTOK_STATE_COOKIE); // нэг удаагийн state — амжилт/бүтэлгүйт хамаарахгүй
    return res;
  };

  const session = await getAdminSession();
  if (!session) return NextResponse.redirect(`${BASE}/auth/signin`);

  const sp = req.nextUrl.searchParams;
  const error = sp.get("error");
  if (error) {
    // Хэрэглэгч "Cancel" дарсан нь эндүүр ирнэ — алдаа биш, шийдвэр.
    const desc = sp.get("error_description") || error;
    return fail(
      error === "access_denied"
        ? "TikTok холболтыг цуцаллаа."
        : `TikTok татгалзлаа: ${desc}`
    );
  }

  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = req.cookies.get(TIKTOK_STATE_COOKIE)?.value || "";

  if (!code) return fail("TikTok authorization code илгээгээгүй байна.");
  if (!state || !cookieState) return fail("OAuth state алга — дахин холбогдоно уу.");

  // Урт нь ижил үед л timingSafeEqual ажиллана; өөр байвал шууд зөрүү.
  const a = Buffer.from(state);
  const b = Buffer.from(cookieState);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return fail("OAuth state таарсангүй — хүсэлтийг аюулгүйн үүднээс цуцаллаа.");
  }

  try {
    const tokens = await TikTokAPI.exchangeCodeForToken(code);
    const api = new TikTokAPI(tokens.access_token);

    // Нэрийг ТААМАГЛАХГҮЙ — TikTok-оос асууна.
    let avatarUrl = "";
    let nickname = "";
    try {
      const info = await api.getUserInfo();
      avatarUrl = info.avatar_url;
      nickname = info.display_name;
    } catch {
      /* профайл татагдахгүй байсан ч холболт өөрөө хүчинтэй — үргэлжилнэ */
    }

    // @handle нь `user.info.basic`-д БАЙХГҮЙ; creator_info-оос ирнэ.
    let username = "";
    try {
      const ci = await api.queryCreatorInfo();
      username = ci.creator_username || "";
      if (!nickname) nickname = ci.creator_nickname || "";
      if (!avatarUrl) avatarUrl = ci.creator_avatar_url || "";
    } catch {
      /* Sandbox-д creator_info унших боломжгүй байж болно — нэргүй үлдэнэ */
    }

    await dbConnect();
    const userId = (session.user as { id: string }).id;

    await TikTokConnection.findOneAndUpdate(
      { userId },
      {
        userId,
        openId: tokens.open_id,
        username,
        nickname,
        avatarUrl,
        accessTokenEnc: encryptToken(tokens.access_token),
        refreshTokenEnc: encryptToken(tokens.refresh_token || ""),
        accessTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 86400) * 1000),
        refreshTokenExpiresAt: tokens.refresh_expires_in
          ? new Date(Date.now() + tokens.refresh_expires_in * 1000)
          : undefined,
        scopes: (tokens.scope || "").split(",").map((x) => x.trim()).filter(Boolean),
        status: "active",
        lastError: "",
        connectedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const res = NextResponse.redirect(`${HOME}?connected=1`);
    res.cookies.delete(TIKTOK_STATE_COOKIE);
    return res;
  } catch (e) {
    // Токен ХЭЗЭЭ Ч лог руу орохгүй — зөвхөн код.
    console.error("[tiktok] callback failed", {
      code: e instanceof TikTokError ? e.code : "unknown",
      logId: e instanceof TikTokError ? e.logId : "",
    });
    return fail(humanError(e));
  }
}
