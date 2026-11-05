import crypto from "crypto";

// ─── Сервер талын токен шифрлэлт (AES-256-GCM) ───
//
// Яагаад ШИНЭ файл: төслийн одоо байгаа OAuth токенууд (ThreadsToken,
// MetaOAuthToken) Mongo дотор ЦЭВЭР ТЕКСТЭЭР хэвтдэг. TikTok-ийн
// access/refresh токен нь хэрэглэгчийн нэрээр видео НИЙТЛЭХ эрхтэй тул
// тэр жишгийг дагуулах нь буруу байв.
//
// Формат: `v1:<iv>:<tag>:<ciphertext>` — бүгд hex. Хувилбарын угтвар нь
// ирээдүйд алгоритм солиход хуучин мөрийг таньж уншиж чадахын тулд.
//
// Түлхүүр нь `TOKEN_ENC_KEY` (64 hex тэмдэгт = 32 байт). БАЙХГҮЙ бол
// ЗОРИУД алдаа шиднэ — чимээгүйхэн цэвэр текстээр хадгалах нь хамгийн
// муу төгсгөл. Түлхүүр үүсгэх:  openssl rand -hex 32

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM-ийн стандарт нонс

function key(): Buffer {
  const raw = process.env.TOKEN_ENC_KEY || "";
  if (!raw) {
    throw new Error("TOKEN_ENC_KEY is not set — refusing to persist tokens in plaintext");
  }
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be 64 hex characters (32 bytes)");
  }
  return buf;
}

export function encryptToken(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(stored: string): string {
  if (!stored) return "";
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Stored token is not in the expected v1 envelope");
  }
  const [, ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Түлхүүр тохируулагдсан эсэх — UI-д "дахин холбогдоно уу" гэхийн оронд
 *  "серверийн тохиргоо дутуу" гэдгийг ялгаж хэлэхэд хэрэгтэй. */
export function tokenCryptoReady(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** Лог руу токен алдахаас сэргийлнэ. Хэзээ ч бүтэн утгыг бичихгүй. */
export function redact(token: string): string {
  if (!token) return "(empty)";
  return `${token.slice(0, 4)}…${token.slice(-4)} (${token.length} chars)`;
}
