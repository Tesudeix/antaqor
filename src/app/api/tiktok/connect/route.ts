import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { TikTokAPI, tiktokConfigured, TIKTOK_STATE_COOKIE } from "@/lib/tiktok";
import { tokenCryptoReady } from "@/lib/tokenCrypto";

export const dynamic = "force-dynamic";


// Алхам 1/2: TikTok руу явуулна.
//
// `state` нь CSRF-ийн ЦОРЫН ГАНЦ хамгаалалт: санамсаргүй 32 байтыг
// HttpOnly cookie-д хийж, TikTok-оос буцаж ирэхэд тулгана. Cookie нь
// SameSite=Lax — TikTok-оос буцах нь ДЭЭД ТҮВШНИЙ навигаци тул Lax
// хангалттай бөгөөд Strict байвал cookie яваад ирэхгүй.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

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

  if (!tiktokConfigured()) {
    return NextResponse.redirect(
      `${BASE}/admin/tiktok?error=${encodeURIComponent(
        "TikTok тохиргоо дутуу: TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REDIRECT_URI"
      )}`
    );
  }
  if (!tokenCryptoReady()) {
    return NextResponse.redirect(
      `${BASE}/admin/tiktok?error=${encodeURIComponent(
        "TOKEN_ENC_KEY тохируулагдаагүй — токен шифрлэхгүйгээр холбохоос татгалзав"
      )}`
    );
  }

  const state = TikTokAPI.newState();
  const res = NextResponse.redirect(TikTokAPI.getAuthorizationUrl(state));
  res.cookies.set(TIKTOK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 минут — OAuth-д илүүдэхгүй
  });
  return res;
}
