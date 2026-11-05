import dbConnect from "@/lib/mongodb";
import TikTokConnection, { ITikTokConnection } from "@/models/TikTokConnection";
import { TikTokAPI, TikTokError } from "@/lib/tiktok";
import { encryptToken, decryptToken } from "@/lib/tokenCrypto";

// TikTok-ийн НЭГ Л ГАРЦ: нэвтэрсэн дуудлага хийхийн өмнө үргэлж эндүүр
// орно. `adminAuth.ts`-ийн `getThreadsClient` -тэй ижил гэрээ, гэхдээ
// TikTok-д refresh token байгаа тул шинэчлэлт нь жинхэнэ.

/** Дуусахаас 5 минутын өмнөөс шинэчилнэ — хүсэлт нисэж байх зуур
 *  хүчингүй болох завсрыг хаана. */
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export async function markReconnect(
  conn: ITikTokConnection,
  reason: string
): Promise<void> {
  conn.status = "reconnect_needed";
  conn.lastError = reason.slice(0, 300);
  await conn.save();
}

export async function getConnection(userId: string): Promise<ITikTokConnection | null> {
  await dbConnect();
  return TikTokConnection.findOne({ userId });
}

/** Шинэчлэгдсэн токентой клиент. Дахин холбогдох шаардлагатай бол `null`.
 *  `null` буцаасан бол мөр нь "reconnect_needed" болсон байна. */
export async function getTikTokClient(
  userId: string
): Promise<{ api: TikTokAPI; conn: ITikTokConnection } | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  if (conn.status === "reconnect_needed") return null;

  let accessToken: string;
  try {
    accessToken = decryptToken(conn.accessTokenEnc);
  } catch {
    // Түлхүүр солигдсон эсвэл алга — хуучин мөрийг тайлж чадахгүй.
    await markReconnect(conn, "Stored token could not be decrypted");
    return null;
  }

  const expiringSoon =
    conn.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;

  if (expiringSoon) {
    if (conn.refreshTokenExpiresAt && conn.refreshTokenExpiresAt <= new Date()) {
      await markReconnect(conn, "Refresh token expired");
      return null;
    }
    let refreshToken = "";
    try {
      refreshToken = decryptToken(conn.refreshTokenEnc);
    } catch {
      await markReconnect(conn, "Stored refresh token could not be decrypted");
      return null;
    }
    if (!refreshToken) {
      await markReconnect(conn, "No refresh token on file");
      return null;
    }
    try {
      const t = await TikTokAPI.refreshAccessToken(refreshToken);
      conn.accessTokenEnc = encryptToken(t.access_token);
      // TikTok шинэ refresh token буцаадаг — хуучныг нь БАРИХГҮЙ.
      if (t.refresh_token) conn.refreshTokenEnc = encryptToken(t.refresh_token);
      conn.accessTokenExpiresAt = new Date(Date.now() + (t.expires_in || 86400) * 1000);
      if (t.refresh_expires_in) {
        conn.refreshTokenExpiresAt = new Date(Date.now() + t.refresh_expires_in * 1000);
      }
      conn.status = "active";
      conn.lastError = "";
      await conn.save();
      accessToken = t.access_token;
    } catch (e) {
      const code = e instanceof TikTokError ? e.code : "refresh_failed";
      // Токен алдагдуулахгүйгээр лог: зөвхөн код.
      console.error("[tiktok] refresh failed", { userId, code });
      await markReconnect(conn, `Refresh failed: ${code}`);
      return null;
    }
  }

  return { api: new TikTokAPI(accessToken), conn };
}

/** 401/auth_removed зэрэг нь "дахин холбогдох хэрэгтэй" гэсэн үг. */
export function isAuthFailure(e: unknown): boolean {
  if (!(e instanceof TikTokError)) return false;
  return (
    e.httpStatus === 401 ||
    e.code === "access_token_invalid" ||
    e.code === "scope_not_authorized" ||
    e.code === "auth_removed"
  );
}
