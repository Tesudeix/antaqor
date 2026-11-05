import SocialPost from "@/models/SocialPost";
import { existsSync } from "fs";
import path from "path";

/* 2026-10-09: /api/upload нь видеог АРД хөрвүүлдэг болсон (хэрэглэгчийг
   хүлээлгэхгүй). Хөрвүүлэлт дуустал `<file>.processing` тэмдэг байна —
   Meta нь ЭЦСИЙН (жижиг, H.264) файлыг татах ёстой тул түүнийг хүлээнэ.
   Дээд тал нь 3 минут; дараа нь байгаа хувилбараараа явуулна. */
async function waitForVideo(url: string) {
  const m = url.match(/\/uploads\/([A-Za-z0-9._-]+\.mp4)$/);
  if (!m) return;
  const marker = path.join(process.cwd(), "public", "uploads", `${m[1]}.processing`);
  for (let i = 0; i < 60 && existsSync(marker); i++) await new Promise((r) => setTimeout(r, 3000));
}
import { publishToAll, type SocialPlatform } from "@/lib/socialPublish";
import { THREADS_MAX_CHARS } from "@/lib/threadsVoice";

/* ─── FEED → THREADS · INSTAGRAM · FACEBOOK ─────────────────────────────
   antaqor.com-ын урсгалд нийтэлсэн постыг гадаад сувгууд руу давхар
   илгээнэ.

   Яагаад хариу хүлээхгүй (fire-and-forget): Threads нь контейнер бэлэн
   болохыг хүлээдэг, Instagram нь зургаа татаж авдаг — гурвуулаа хэдэн
   секунд. Тэрийг хүлээвэл сайт дээрх "Нийтлэх" товч гацсан мэт болно.
   Үр дүн нь `SocialPost` бичлэгт тэмдэглэгдэж /admin/social дээр
   харагдана, тиймээс алдаа чимээгүй алга болохгүй. */

const SITE = "https://antaqor.com";

/** Харьцангуй замыг нийтэд хүрэх бүтэн хаяг болгоно. Meta болон Threads
 *  хоёулаа зөвхөн гаднаас татаж болох хаягийг хүлээж авдаг. */
function absolute(u?: string): string {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return SITE + s;
  return "";
}

/* Threads 500 тэмдэгт. Урт постыг таслаад буцах холбоос тавина —
   таслагдсан бодол нь уншигчийг бухимдуулдаг, холбоос нь түүнийг
   сайт руу авчирна. */
export function threadsText(content: string, postId: string): string {
  const body = String(content || "").trim();
  const link = `${SITE}/posts/${postId}`;
  if (body.length <= THREADS_MAX_CHARS) return body;
  const room = THREADS_MAX_CHARS - link.length - 4;
  return body.slice(0, Math.max(0, room)).replace(/\s+\S*$/, "") + "…\n" + link;
}

export interface CrosspostResult {
  ok: boolean;
  platforms: SocialPlatform[];
  socialPostId?: string;
  skipped?: string;
}

export async function crosspostFeedPost(args: {
  postId: string;
  content: string;
  images?: string[];
  video?: string;
  byEmail?: string;
  /** Composer-оос админ сонгосон сувгууд (2026-10-09). Өгөөгүй бол бүгд. */
  platforms?: SocialPlatform[];
}): Promise<CrosspostResult> {
  const content = String(args.content || "").trim();
  const imageUrl = absolute((args.images || [])[0]);
  const videoUrl = absolute(args.video);

  if (!content && !imageUrl && !videoUrl) {
    return { ok: false, platforms: [], skipped: "хоосон" };
  }

  /* INSTAGRAM нь ТЕКСТ ДАНГААР хүлээж авдаггүй — API-ийн хатуу шаардлага,
     сонголт биш. Зураг/видеогүй бол тэр сувгийг алгасахаас өөр арга
     байхгүй; оролдвол зүгээр л алдаа буцна. */
  let platforms: SocialPlatform[] = ["facebook", "threads"];
  if (imageUrl || videoUrl) platforms.push("instagram");
  if (args.platforms) platforms = platforms.filter((p) => args.platforms!.includes(p));
  if (!platforms.length) return { ok: false, platforms: [], skipped: "суваг сонгоогүй" };

  const post = await SocialPost.create({
    text: content,
    imageUrl, videoUrl,
    platforms,
    state: "publishing",
    brief: "Feed давхар нийтлэлт — " + SITE + "/posts/" + args.postId,
    createdByEmail: args.byEmail || "",
  });

  try {
    if (videoUrl) await waitForVideo(videoUrl);
    const results = await publishToAll({
      text: content,
      imageUrl: imageUrl || undefined,
      videoUrl: videoUrl || undefined,
      platforms,
      /* Threads-д богино хувилбар — бусдад бүтэн текст. */
      overrides: { threads: threadsText(content, args.postId) },
    });

    const ok = results.some((r) => r.status === "ok");
    post.results = results.map((r) => ({
      platform: r.platform, status: r.status, externalId: r.externalId || "",
      permalink: r.permalink || "", error: r.error || "", ms: r.ms, at: new Date(),
    })) as never;
    post.state = ok ? "published" : "failed";
    post.lastError = ok ? "" : results.map((r) => r.error).filter(Boolean).join(" · ").slice(0, 400);
    await post.save();

    return { ok, platforms, socialPostId: String(post._id) };
  } catch (e) {
    post.state = "failed";
    post.lastError = (e as Error).message?.slice(0, 400) || "давхар нийтлэлт унав";
    await post.save().catch(() => {});
    return { ok: false, platforms, socialPostId: String(post._id) };
  }
}
