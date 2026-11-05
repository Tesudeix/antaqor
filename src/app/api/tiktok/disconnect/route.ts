import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { getConnection } from "@/lib/tiktokAuth";
import { TikTokAPI } from "@/lib/tiktok";
import { decryptToken } from "@/lib/tokenCrypto";
import TikTokConnection from "@/models/TikTokConnection";

export const dynamic = "force-dynamic";

// Салгах. TikTok тал дээрх зөвшөөрлийг ЭХЛЭЭД цуцалж, дараа нь дотоод
// мөрөө устгана. Цуцлалт бүтэлгүйтсэн ч мөрийг УСТГАНА: хэрэглэгч
// "салга" гэсэн бол манай тал дээр токен үлдэх ёсгүй.
export async function POST() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const userId = (session.user as { id: string }).id;
  const conn = await getConnection(userId);
  if (!conn) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  let revoked = false;
  try {
    const token = decryptToken(conn.accessTokenEnc);
    if (token) {
      await TikTokAPI.revokeToken(token);
      revoked = true;
    }
  } catch (e) {
    console.error("[tiktok] revoke failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
  }

  await TikTokConnection.deleteOne({ _id: conn._id });
  return NextResponse.json({ ok: true, revoked });
}
