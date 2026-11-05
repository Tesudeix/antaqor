import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { getTikTokClient, isAuthFailure, markReconnect } from "@/lib/tiktokAuth";
import { TikTokError, humanError } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

// Нийтлэх дэлгэц НЭЭГДЭХ бүрд дуудна. Нууцлалын сонголт, сэтгэгдэл/
// duet/stitch-ийн боломж, видеоны дээд урт — БҮГД ЭНДЭЭС. Урьдчилан
// хатуу бичих эрхгүй: TikTok-ийн шаардлага бөгөөд акаунт бүрт өөр.
export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const userId = (session.user as { id: string }).id;
  const client = await getTikTokClient(userId);
  if (!client) {
    return NextResponse.json(
      { error: "TikTok холбогдоогүй эсвэл дахин холбогдох шаардлагатай.", needsReconnect: true },
      { status: 409 }
    );
  }

  try {
    const info = await client.api.queryCreatorInfo();

    // Кэшлэсэн нэрийг шинэчилнэ — TikTok дээр солигдсон байж болно.
    if (info.creator_username && info.creator_username !== client.conn.username) {
      client.conn.username = info.creator_username;
      client.conn.nickname = info.creator_nickname || client.conn.nickname;
      client.conn.avatarUrl = info.creator_avatar_url || client.conn.avatarUrl;
      await client.conn.save();
    }

    return NextResponse.json(info);
  } catch (e) {
    if (isAuthFailure(e)) {
      await markReconnect(client.conn, e instanceof TikTokError ? e.code : "auth");
      return NextResponse.json(
        { error: humanError(e), needsReconnect: true },
        { status: 409 }
      );
    }
    console.error("[tiktok] creator_info failed", {
      code: e instanceof TikTokError ? e.code : "unknown",
      logId: e instanceof TikTokError ? e.logId : "",
    });
    return NextResponse.json({ error: humanError(e) }, { status: 502 });
  }
}
