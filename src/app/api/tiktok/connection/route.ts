import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { getConnection } from "@/lib/tiktokAuth";
import { tiktokConfigured } from "@/lib/tiktok";
import { tokenCryptoReady } from "@/lib/tokenCrypto";

export const dynamic = "force-dynamic";

// UI-ийн холболтын төлөв. ТОКЕН ХЭЗЭЭ Ч энд орохгүй — зөвхөн нэр, төлөв.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const configured = tiktokConfigured() && tokenCryptoReady();
  const userId = (session.user as { id: string }).id;
  const conn = await getConnection(userId);

  if (!conn) {
    return NextResponse.json({ configured, connected: false });
  }

  return NextResponse.json({
    configured,
    connected: conn.status === "active",
    needsReconnect: conn.status === "reconnect_needed",
    username: conn.username,
    nickname: conn.nickname,
    avatarUrl: conn.avatarUrl,
    scopes: conn.scopes,
    connectedAt: conn.connectedAt,
    lastError: conn.lastError,
  });
}
