import crypto from "crypto";

// ─── TikTok Login Kit + Content Posting API ───
//
// `src/lib/threads.ts`-ийн хэв маягийг дагасан: OAuth нь СТАТИК метод,
// нэвтэрсэн дуудлагууд нь ИНСТАНС метод. Ялгаа нь TikTok-д refresh token
// БАЙДАГ (access 24 цаг, refresh 365 хоног) тул шинэчлэлт нь заавал.
//
// Бүх эндпойнт нь TikTok-ийн ОДООГИЙН v2 баримтаас (2026-09) авсан:
//   authorize   https://www.tiktok.com/v2/auth/authorize/
//   token       https://open.tiktokapis.com/v2/oauth/token/
//   revoke      https://open.tiktokapis.com/v2/oauth/revoke/
//   creator     https://open.tiktokapis.com/v2/post/publish/creator_info/query/
//   init        https://open.tiktokapis.com/v2/post/publish/video/init/
//   status      https://open.tiktokapis.com/v2/post/publish/status/fetch/
//
// v2 API-ийн хариу нь ҮРГЭЛЖ `{ data, error: { code, message, log_id } }`
// хэлбэртэй бөгөөд АМЖИЛТТАЙ үед ч `error.code === "ok"` гэж ирнэ — 200
// ирсэн нь болсон гэсэн үг БИШ.

const AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";

/* OAuth state-ийг барих HttpOnly cookie-ийн нэр. ЭНД байрлана:
   Next.js-ийн route handler нь GET/POST/dynamic зэрэг ТОГТСОН
   нэрсээс өөрийг export хийхийг зөвшөөрдөггүй. */
export const TIKTOK_STATE_COOKIE = "tiktok_oauth_state";
const API = "https://open.tiktokapis.com/v2";

export interface TikTokTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  token_type: string;
}

export interface CreatorInfo {
  creator_avatar_url: string;
  creator_username: string;
  creator_nickname: string;
  privacy_level_options: string[];
  comment_disabled: boolean;
  duet_disabled: boolean;
  stitch_disabled: boolean;
  max_video_post_duration_sec: number;
}

export type PublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

/** TikTok-ийн алдааг кодтой нь хамт зөөнө — дуудагч нь `code` дээрээ
 *  тулгуурлаж "дахин холбогдох уу, эсвэл дахин оролдох уу"-г шийднэ. */
export class TikTokError extends Error {
  code: string;
  logId: string;
  httpStatus: number;
  constructor(code: string, message: string, logId = "", httpStatus = 0) {
    super(message || code);
    this.name = "TikTokError";
    this.code = code;
    this.logId = logId;
    this.httpStatus = httpStatus;
  }
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

export function tiktokConfigured(): boolean {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY &&
      process.env.TIKTOK_CLIENT_SECRET &&
      process.env.TIKTOK_REDIRECT_URI
  );
}

export function tiktokScopes(): string {
  return process.env.TIKTOK_SCOPES || "user.info.basic,video.publish";
}

/** v2 REST хариуг задалж, `error.code !== "ok"` бүрийг шиднэ. */
async function unwrap<T>(res: Response): Promise<T> {
  let body: {
    data?: T;
    error?: { code?: string; message?: string; log_id?: string };
  };
  try {
    body = await res.json();
  } catch {
    throw new TikTokError("invalid_response", `TikTok returned non-JSON (HTTP ${res.status})`, "", res.status);
  }
  const err = body.error;
  if (err && err.code && err.code !== "ok") {
    throw new TikTokError(err.code, err.message || "", err.log_id || "", res.status);
  }
  if (!res.ok) {
    throw new TikTokError("http_error", `TikTok HTTP ${res.status}`, err?.log_id || "", res.status);
  }
  return (body.data ?? ({} as T)) as T;
}

export class TikTokAPI {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // ── OAuth (статик) ──────────────────────────────────────────────────

  /** CSRF-ээс хамгаалах санамсаргүй state. Cookie-д хадгалж, буцахад тулгана. */
  static newState(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  static getAuthorizationUrl(state: string): string {
    const u = new URL(AUTH_BASE);
    u.searchParams.set("client_key", env("TIKTOK_CLIENT_KEY"));
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", tiktokScopes());
    u.searchParams.set("redirect_uri", env("TIKTOK_REDIRECT_URI"));
    u.searchParams.set("state", state);
    return u.toString();
  }

  /** OAuth токен эндпойнт нь v2 REST-ээс ӨӨР хэлбэртэй: формоор илгээж,
   *  алдаа нь дээд түвшний `error` / `error_description` талбараар ирнэ. */
  private static async tokenRequest(form: Record<string, string>): Promise<TikTokTokens> {
    const res = await fetch(`${API}/oauth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams(form).toString(),
    });
    const body = await res.json().catch(() => ({}));
    if (body.error) {
      throw new TikTokError(
        String(body.error),
        String(body.error_description || ""),
        String(body.log_id || ""),
        res.status
      );
    }
    if (!res.ok || !body.access_token) {
      throw new TikTokError("token_exchange_failed", `TikTok HTTP ${res.status}`, "", res.status);
    }
    return body as TikTokTokens;
  }

  static exchangeCodeForToken(code: string): Promise<TikTokTokens> {
    return TikTokAPI.tokenRequest({
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: env("TIKTOK_REDIRECT_URI"),
    });
  }

  static refreshAccessToken(refreshToken: string): Promise<TikTokTokens> {
    return TikTokAPI.tokenRequest({
      client_key: env("TIKTOK_CLIENT_KEY"),
      client_secret: env("TIKTOK_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  /** Салгахад TikTok тал дээрх зөвшөөрлийг ч цуцална. Амжилтгүй бол
   *  шиднэ — дуудагч нь дотоод мөрөө ямар ч байсан устгана. */
  static async revokeToken(accessToken: string): Promise<void> {
    const res = await fetch(`${API}/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: env("TIKTOK_CLIENT_KEY"),
        client_secret: env("TIKTOK_CLIENT_SECRET"),
        token: accessToken,
      }).toString(),
    });
    const body = await res.json().catch(() => ({}));
    if (body.error) {
      throw new TikTokError(String(body.error), String(body.error_description || ""), "", res.status);
    }
  }

  // ── Нэвтэрсэн дуудлагууд ────────────────────────────────────────────

  private authHeaders(json = true): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.accessToken}` };
    if (json) h["Content-Type"] = "application/json; charset=UTF-8";
    return h;
  }

  /** Нийтлэх товч ГАРАХААС ӨМНӨ заавал дуудна: нууцлалын сонголт,
   *  сэтгэгдэл/duet/stitch-ийн боломж, дээд урт — бүгд ЭНДЭЭС ирнэ.
   *  Эдгээрийг таамаглах эрхгүй (TikTok-ийн шаардлага). */
  async queryCreatorInfo(): Promise<CreatorInfo> {
    const res = await fetch(`${API}/post/publish/creator_info/query/`, {
      method: "POST",
      headers: this.authHeaders(),
    });
    return unwrap<CreatorInfo>(res);
  }

  /* Login Kit-ийн үндсэн профайл. АНХААР: `username` (@handle) нь ЭНД
     БАЙХГҮЙ — тэр талбар `user.info.profile` эрх шаарддаг бөгөөд бид
     `user.info.basic,video.publish`-г л хүсдэг. @handle нь оронд нь
     `creator_info/query`-оос ирнэ (`video.publish` эрхээр). */
  async getUserInfo(): Promise<{
    open_id: string;
    avatar_url: string;
    display_name: string;
  }> {
    const u = new URL(`${API}/user/info/`);
    u.searchParams.set("fields", "open_id,avatar_url,display_name");
    const res = await fetch(u.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    const data = await unwrap<{ user?: { open_id?: string; avatar_url?: string; display_name?: string } }>(res);
    return {
      open_id: data.user?.open_id || "",
      avatar_url: data.user?.avatar_url || "",
      display_name: data.user?.display_name || "",
    };
  }

  async initDirectPost(params: {
    title: string;
    privacyLevel: string;
    disableComment: boolean;
    disableDuet: boolean;
    disableStitch: boolean;
    isAigc: boolean;
    videoSize: number;
    chunkSize: number;
    totalChunkCount: number;
  }): Promise<{ publish_id: string; upload_url: string }> {
    const res = await fetch(`${API}/post/publish/video/init/`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({
        post_info: {
          title: params.title,
          privacy_level: params.privacyLevel,
          disable_comment: params.disableComment,
          disable_duet: params.disableDuet,
          disable_stitch: params.disableStitch,
          is_aigc: params.isAigc,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: params.videoSize,
          chunk_size: params.chunkSize,
          total_chunk_count: params.totalChunkCount,
        },
      }),
    });
    return unwrap<{ publish_id: string; upload_url: string }>(res);
  }

  async fetchStatus(publishId: string): Promise<{
    status: PublishStatus;
    fail_reason?: string;
    uploaded_bytes?: number;
    publicaly_available_post_id?: number[];
  }> {
    const res = await fetch(`${API}/post/publish/status/fetch/`, {
      method: "POST",
      headers: this.authHeaders(),
      body: JSON.stringify({ publish_id: publishId }),
    });
    return unwrap(res);
  }
}

/** Байт мөрийг TikTok-ийн `upload_url` руу PUT-ээр илгээнэ.
 *  Токен ЯВАХГҮЙ: upload_url нь өөрөө гарын үсэгтэй. */
export async function uploadChunk(
  uploadUrl: string,
  chunk: Buffer,
  firstByte: number,
  lastByte: number,
  totalBytes: number,
  mime: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mime,
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${firstByte}-${lastByte}/${totalBytes}`,
    },
    body: new Uint8Array(chunk),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new TikTokError(
      "upload_failed",
      `Chunk ${firstByte}-${lastByte} rejected (HTTP ${res.status}) ${text.slice(0, 200)}`,
      "",
      res.status
    );
  }
}

/** TikTok-ийн хэсэгчлэх дүрэм (media transfer guide):
 *  · 5MB ≤ chunk ≤ 64MB, СҮҮЛИЙН хэсэг 128MB хүртэл байж БОЛНО
 *  · total_chunk_count = floor(video_size / chunk_size) — үлдэгдлийг
 *    сүүлийн хэсэг ЗАЛГИНА, тусдаа хэсэг БОЛОХГҮЙ
 *  · 5MB-аас жижиг файл нь ГАНЦ хэсэг, chunk_size = файлын хэмжээ
 *  · дээд тал нь 1000 хэсэг, файл 4GB хүртэл */
const MB = 1024 * 1024;
export const TIKTOK_MAX_VIDEO_BYTES = 4 * 1024 * MB;

export function planChunks(videoSize: number): { chunkSize: number; totalChunkCount: number } {
  // 64MB хүртэлх бүх файлыг ганц хэсгээр — жижиг рийлд хамгийн найдвартай.
  if (videoSize <= 64 * MB) {
    return { chunkSize: videoSize, totalChunkCount: 1 };
  }
  const chunkSize = 32 * MB;
  const totalChunkCount = Math.floor(videoSize / chunkSize);
  return { chunkSize, totalChunkCount };
}

/** Кодыг хүн уншихуйц мессеж болгоно. Техникийн дэлгэрэнгүй нь серверийн
 *  лог руу; хэрэглэгч юу хийхээ мэдэх ёстой. */
export function humanError(e: unknown): string {
  if (e instanceof TikTokError) {
    const map: Record<string, string> = {
      access_token_invalid: "TikTok холболт хүчингүй болжээ. Дахин холбогдоно уу.",
      scope_not_authorized: "TikTok дээр нийтлэх зөвшөөрөл олгогдоогүй байна. Дахин холбогдож video.publish-г зөвшөөрнө үү.",
      rate_limit_exceeded: "TikTok хэт олон хүсэлт гэж үзлээ. Хэдэн минутын дараа дахин оролдоно уу.",
      spam_risk_too_many_posts: "TikTok өнөөдрийн нийтлэлийн хязгаарт хүрсэн байна.",
      spam_risk_user_banned_from_posting: "Энэ TikTok акаунтад нийтлэх эрх хаагдсан байна.",
      reached_active_user_cap: "Sandbox-ийн хэрэглэгчийн хязгаарт хүрсэн байна.",
      file_format_check_failed: "Видеоны формат TikTok-д тохирохгүй байна.",
      duration_check_failed: "Видеоны урт TikTok-ийн зөвшөөрөхөөс хэтэрсэн байна.",
      frame_rate_check_failed: "Видеоны кадрын давтамж тохирохгүй байна.",
      picture_size_check_failed: "Видеоны хэмжээс тохирохгүй байна.",
      auth_removed: "TikTok дээрх зөвшөөрөл цуцлагдсан байна. Дахин холбогдоно уу.",
      publish_cancelled: "Нийтлэлийг цуцалсан байна.",
      invalid_param: "TikTok илгээсэн утгыг хүлээж авсангүй.",
    };
    return map[e.code] || `TikTok алдаа: ${e.code}`;
  }
  return e instanceof Error ? e.message : "Тодорхойгүй алдаа";
}
