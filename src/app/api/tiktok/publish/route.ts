import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import AiVideo from "@/models/AiVideo";
import AiCreation from "@/models/AiCreation";
import TikTokPost from "@/models/TikTokPost";
import { getTikTokClient, isAuthFailure, markReconnect } from "@/lib/tiktokAuth";
import {
  TikTokError,
  humanError,
  planChunks,
  uploadChunk,
  TIKTOK_MAX_VIDEO_BYTES,
} from "@/lib/tiktok";
import { statUpload } from "@/lib/localMedia";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CAPTION = 2200;

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

// Шууд нийтлэх. Хэрэглэгч "Нийтлэх" дарсны ДАРАА л энд ирнэ — автоматаар
// дуудагддаг газар БАЙХГҮЙ.
//
// ХАМГИЙН ЧУХАЛ: нууцлал болон сэтгэгдэл/duet/stitch-ийн сонголтыг
// browser-аас ирсэн утгаар нь ИТГЭЖ АВАХГҮЙ. Нийтлэхийн өмнө creator_info-г
// ДАХИН дуудаж, сонголт бүрийг түүн дээр тулгана: хуудас нээснээс хойш
// TikTok дээрх тохиргоо өөрчлөгдсөн байж болно, мөн client-ийн утга
// хуурамч байж ч болно.
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const userId = (session.user as { id: string }).id;

  let body: {
    videoId?: string;
    kind?: string;
    caption?: string;
    privacyLevel?: string;
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
    isAigc?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return bad("Хүсэлтийн бие буруу байна.");
  }

  const kind = body.kind === "aicreation" ? "aicreation" : "aivideo";
  const videoId = String(body.videoId || "");
  if (!videoId) return bad("Видео сонгоогүй байна.");

  const caption = String(body.caption || "").slice(0, MAX_CAPTION);
  const privacyLevel = String(body.privacyLevel || "");
  if (!privacyLevel) return bad("Нууцлалын түвшин сонгоогүй байна.");

  await dbConnect();

  // ── Эх видео ──
  const doc =
    kind === "aivideo"
      ? await AiVideo.findById(videoId).select("videoUrl duration status").lean()
      : await AiCreation.findById(videoId).select("videoUrl duration status").lean();
  if (!doc) return bad("Видео олдсонгүй.");
  if (doc.status !== "done") return bad("Энэ видео хараахан бэлэн болоогүй байна.");

  const stat = await statUpload(doc.videoUrl);
  if (!stat) {
    return bad("Видео файл дискнээс олдсонгүй, эсвэл TikTok дэмждэггүй формат байна (mp4 / mov / webm).");
  }
  if (stat.bytes > TIKTOK_MAX_VIDEO_BYTES) return bad("Видео 4GB-аас том байна.");
  if (stat.bytes === 0) return bad("Видео файл хоосон байна.");

  // ── Холболт ──
  const client = await getTikTokClient(userId);
  if (!client) {
    return NextResponse.json(
      { error: "TikTok холбогдоогүй эсвэл дахин холбогдох шаардлагатай.", needsReconnect: true },
      { status: 409 }
    );
  }

  // ── TikTok-ийн ОДООГИЙН дүрмээр шалгах ──
  let info;
  try {
    info = await client.api.queryCreatorInfo();
  } catch (e) {
    if (isAuthFailure(e)) {
      await markReconnect(client.conn, e instanceof TikTokError ? e.code : "auth");
      return NextResponse.json({ error: humanError(e), needsReconnect: true }, { status: 409 });
    }
    return NextResponse.json({ error: humanError(e) }, { status: 502 });
  }

  if (!info.privacy_level_options?.includes(privacyLevel)) {
    return bad(
      `TikTok энэ акаунтад "${privacyLevel}" нууцлалыг зөвшөөрөхгүй байна. Боломжтой нь: ${(
        info.privacy_level_options || []
      ).join(", ")}`
    );
  }

  const durationSec = Number(doc.duration) || 0;
  if (info.max_video_post_duration_sec && durationSec > info.max_video_post_duration_sec) {
    return bad(
      `Видео ${durationSec} секунд байна. Энэ акаунт дээд тал нь ${info.max_video_post_duration_sec} секунд нийтэлж чадна.`
    );
  }

  /* TikTok хориглосныг хэрэглэгч НЭЭЖ ЧАДАХГҮЙ. Хориотой бол хүчээр
     унтраана — client-ээс `false` ирсэн ч хамаагүй. */
  const disableComment = info.comment_disabled ? true : Boolean(body.disableComment);
  const disableDuet = info.duet_disabled ? true : Boolean(body.disableDuet);
  const disableStitch = info.stitch_disabled ? true : Boolean(body.disableStitch);
  const isAigc = Boolean(body.isAigc);

  const { chunkSize, totalChunkCount } = planChunks(stat.bytes);

  // ── Аудитын мөр — илгээхийн ӨМНӨ ──
  const post = await TikTokPost.create({
    userId,
    openId: client.conn.openId,
    sourceKind: kind,
    sourceId: videoId,
    videoUrl: doc.videoUrl,
    caption,
    privacyLevel,
    disableComment,
    disableDuet,
    disableStitch,
    isAigc,
    bytes: stat.bytes,
    status: "QUEUED",
  });

  try {
    const init = await client.api.initDirectPost({
      title: caption,
      privacyLevel,
      disableComment,
      disableDuet,
      disableStitch,
      isAigc,
      videoSize: stat.bytes,
      chunkSize,
      totalChunkCount,
    });

    post.publishId = init.publish_id;
    post.status = "UPLOADING";
    await post.save();

    /* Байтуудыг ДАРААЛЛААР нь илгээнэ (TikTok-ийн шаардлага). Бүх файлыг
       санах ойд ачаалахгүй — хэсэг бүрийг дискнээс тухайн үед нь уншина.
       Сүүлийн хэсэг нь үлдэгдлийг ЗАЛГИНА: total_chunk_count нь
       floor(size / chunk) тул үлдсэн байтууд тусдаа хэсэг БОЛОХГҮЙ. */
    const fh = await fs.open(stat.abs, "r");
    try {
      for (let i = 0; i < totalChunkCount; i++) {
        const first = i * chunkSize;
        const isLast = i === totalChunkCount - 1;
        const len = isLast ? stat.bytes - first : chunkSize;
        const buf = Buffer.alloc(len);
        await fh.read(buf, 0, len, first);
        await uploadChunk(init.upload_url, buf, first, first + len - 1, stat.bytes, stat.mime);
      }
    } finally {
      await fh.close();
    }

    post.status = "PROCESSING";
    post.tiktokStatus = "PROCESSING_UPLOAD";
    await post.save();

    return NextResponse.json({
      ok: true,
      publishId: init.publish_id,
      postId: String(post._id),
      status: post.status,
    });
  } catch (e) {
    const code = e instanceof TikTokError ? e.code : "unknown";
    console.error("[tiktok] publish failed", {
      userId,
      postId: String(post._id),
      code,
      logId: e instanceof TikTokError ? e.logId : "",
    });
    post.status = "FAILED";
    post.errorCode = code;
    post.errorMessage = humanError(e).slice(0, 500);
    await post.save();

    if (isAuthFailure(e)) {
      await markReconnect(client.conn, code);
      return NextResponse.json(
        { error: humanError(e), needsReconnect: true, postId: String(post._id) },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: humanError(e), postId: String(post._id) },
      { status: 502 }
    );
  }
}
