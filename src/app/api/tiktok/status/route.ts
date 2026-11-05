import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import TikTokPost, { TikTokPostStatus } from "@/models/TikTokPost";
import { getTikTokClient, isAuthFailure, markReconnect } from "@/lib/tiktokAuth";
import { TikTokError, humanError, PublishStatus } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/* TikTok-ийн төлөвийг МАНАЙ төлөв рүү буулгана. `PUBLISH_COMPLETE` ирэх
   хүртэл "Нийтлэгдлээ" гэж ХЭЛЭХГҮЙ.

   `SEND_TO_USER_INBOX` нь тусдаа тохиолдол: файл TikTok-д ОЧСОН боловч
   хэрэглэгчийн inbox-д ноорог болж хүлээж байна — дуусгал мөн, гэхдээ
   профайл дээр гараагүй. Түүхий утгыг нь UI рүү хамт дамжуулж, аль нь
   болохыг нуухгүй. */
const MAP: Record<PublishStatus, TikTokPostStatus> = {
  PROCESSING_UPLOAD: "PROCESSING",
  PROCESSING_DOWNLOAD: "PROCESSING",
  SEND_TO_USER_INBOX: "PUBLISHED",
  PUBLISH_COMPLETE: "PUBLISHED",
  FAILED: "FAILED",
};

async function handle(publishId: string) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const userId = (session.user as { id: string }).id;

  if (!publishId) return NextResponse.json({ error: "publish_id алга." }, { status: 400 });

  await dbConnect();
  const post = await TikTokPost.findOne({ publishId, userId });
  if (!post) return NextResponse.json({ error: "Нийтлэл олдсонгүй." }, { status: 404 });

  // Аль хэдийн дууссан бол TikTok-ийг дахин зовоохгүй (30 хүсэлт/мин).
  if (post.status === "PUBLISHED" || post.status === "FAILED") {
    return NextResponse.json({
      status: post.status,
      tiktokStatus: post.tiktokStatus,
      errorMessage: post.errorMessage,
    });
  }

  const client = await getTikTokClient(userId);
  if (!client) {
    return NextResponse.json(
      { error: "TikTok холбогдоогүй байна.", needsReconnect: true },
      { status: 409 }
    );
  }

  try {
    const s = await client.api.fetchStatus(publishId);
    post.tiktokStatus = s.status;
    post.status = MAP[s.status] || "PROCESSING";
    if (s.status === "FAILED") {
      post.errorCode = s.fail_reason || "failed";
      post.errorMessage = humanError(
        new TikTokError(s.fail_reason || "failed", "")
      ).slice(0, 500);
    }
    await post.save();

    return NextResponse.json({
      status: post.status,
      tiktokStatus: post.tiktokStatus,
      uploadedBytes: s.uploaded_bytes,
      publicPostIds: s.publicaly_available_post_id || [],
      errorMessage: post.errorMessage,
    });
  } catch (e) {
    if (isAuthFailure(e)) {
      await markReconnect(client.conn, e instanceof TikTokError ? e.code : "auth");
      return NextResponse.json({ error: humanError(e), needsReconnect: true }, { status: 409 });
    }
    console.error("[tiktok] status fetch failed", {
      code: e instanceof TikTokError ? e.code : "unknown",
    });
    return NextResponse.json({ error: humanError(e) }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req.nextUrl.searchParams.get("publish_id") || "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return handle(String(body.publishId || body.publish_id || ""));
}
