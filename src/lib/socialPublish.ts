// ─────────────────────────────────────────────────────────────────────────
// One post → Facebook + Instagram + Threads.
//
// Each network has its own publishing contract; this module hides all three
// behind `publishToAll()` so the admin composer only has to send text + an
// optional image once.
//
//   Facebook  POST /{page}/feed (text) or /{page}/photos (image)   — 1 call
//   Instagram POST /{ig}/media → poll container → /{ig}/media_publish
//   Threads   POST /{uid}/threads → (poll) → /{uid}/threads_publish
//
// Partial failure is normal (a dead FB token must not block Threads), so every
// platform is published independently and reported on its own.
// ─────────────────────────────────────────────────────────────────────────

import dbConnect from "@/lib/mongodb";
import MetaPage from "@/models/MetaPage";
import { getThreadsClient } from "@/lib/adminAuth";
import type { ThreadsPostOptions } from "@/lib/threads";

import { PLATFORMS, type SocialPlatform } from "@/lib/socialInput";
export { PLATFORMS, PLATFORM_LABEL, TEXT_LIMIT, NEEDS_IMAGE, validate, textFor } from "@/lib/socialInput";
export type { SocialPlatform } from "@/lib/socialInput";
import { textFor } from "@/lib/socialInput";

const FB = "https://graph.facebook.com/v21.0";
// Instagram-Login apps (IGAA… tokens) talk to graph.instagram.com, not graph.facebook.com.
const IG_LOGIN = "https://graph.instagram.com/v21.0";

type J = Record<string, unknown>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gj(url: string, init?: RequestInit): Promise<J> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000) });
    const data = (await r.json()) as J;
    return !r.ok && !data.error ? { error: { message: `Graph HTTP ${r.status}` } } : data;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "Network error" }, uncertain: true };
  }
}

function errOf(j: J, fallback = "Graph API алдаа"): string {
  const e = j.error as J | undefined;
  if (!e) return "";
  return String(e.message || fallback);
}

function form(base: string, path: string, body: Record<string, string>) {
  return gj(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

function read(base: string, node: string, fields: string, token: string) {
  return gj(`${base}/${node}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);
}

// ── Targets ──────────────────────────────────────────────────────────────
// A "target" is one Facebook Page + the Instagram business account linked to
// it. DB-registered pages (self-service /admin/pages, OAuth) win over the
// legacy env-configured trio.

export type MetaTarget = {
  key: string;
  label: string;
  pageId: string;
  igId: string;
  pageToken: string;
  igToken: string;
};

function envTargets(): MetaTarget[] {
  return [
    {
      key: "antaqor",
      label: "Antaqor",
      pageId: process.env.META_PAGE_ID || "",
      igId: process.env.META_IG_BUSINESS_ID || "",
      pageToken: process.env.FB_PAGE_ACCESS_TOKEN || "",
      igToken: process.env.IG_ACCESS_TOKEN || process.env.FB_PAGE_ACCESS_TOKEN || "",
    },
    {
      key: "joymassage",
      label: "joymassage · @cityandjoy",
      pageId: process.env.JOYMASSAGE_PAGE_ID || "",
      igId: process.env.JOYMASSAGE_IG_BUSINESS_ID || "",
      pageToken: process.env.JOYMASSAGE_PAGE_ACCESS_TOKEN || "",
      igToken: process.env.JOYMASSAGE_IG_ACCESS_TOKEN || process.env.JOYMASSAGE_PAGE_ACCESS_TOKEN || "",
    },
    {
      key: "joybilliard",
      label: "Joy billiard · @joy.billiard",
      pageId: process.env.JOYBILLIARD_PAGE_ID || "",
      igId: process.env.JOYBILLIARD_IG_BUSINESS_ID || "",
      pageToken: process.env.JOYBILLIARD_PAGE_ACCESS_TOKEN || "",
      igToken: process.env.JOYBILLIARD_IG_ACCESS_TOKEN || process.env.JOYBILLIARD_PAGE_ACCESS_TOKEN || "",
    },
  ];
}

export async function listMetaTargets(): Promise<MetaTarget[]> {
  await dbConnect();
  const rows = await MetaPage.find({ enabled: true })
    .select("key pageId name igBusinessId pageAccessToken")
    .sort({ createdAt: 1 })
    .lean<{ key: string; pageId: string; name?: string; igBusinessId?: string; pageAccessToken?: string }[]>();

  const fromDb: MetaTarget[] = rows.map((r) => ({
    key: r.key,
    label: r.name || r.pageId,
    pageId: r.pageId,
    igId: r.igBusinessId || "",
    pageToken: r.pageAccessToken || "",
    igToken: r.pageAccessToken || "",
  }));

  const known = new Set(fromDb.map((t) => t.pageId));
  const fromEnv = envTargets().filter((t) => t.pageId && t.pageToken && !known.has(t.pageId));
  return [...fromDb, ...fromEnv];
}

export async function metaTargetFor(key?: string): Promise<MetaTarget | null> {
  const all = await listMetaTargets();
  const hit = key ? all.find((t) => t.key === key) : all[0];
  if (hit) return hit;
  /* Antaqor Agent-ийн түрээслэгчийн хуудас ("<ws>:<pageId>") — эзний жагсаалтад ОРОХГҮЙ,
     зөвхөн нийтлэгч энд түлхүүрээр нь олно. */
  if (key && key.includes(":")) {
    const { AgentConn } = await import("@/models/AgentWorkspace");
    const c = await AgentConn.findOne({ platform: "meta", key }).select("+pageToken key label pageId igId").lean<{ key: string; label: string; pageId: string; igId: string; pageToken: string }>();
    if (c?.pageToken) return { key: c.key, label: c.label || c.pageId, pageId: c.pageId, igId: c.igId || "", pageToken: c.pageToken, igToken: c.pageToken };
  }
  return null;
}

// ── Per-platform publishers ───────────────────────────────────────────────

type Attempt = { status: "ok" | "error" | "unknown"; externalId?: string; permalink?: string; error?: string };

export async function publishFacebook(t: MetaTarget, text: string, imageUrl?: string, videoUrl?: string): Promise<Attempt> {
  if (!t.pageId || !t.pageToken) {
    return { status: "error", error: "Facebook хуудас холбогдоогүй байна." };
  }
  if (videoUrl) return publishFacebookReel(t, text, videoUrl);
  const res = imageUrl
    ? await form(FB, `/${t.pageId}/photos`, { url: imageUrl, caption: text, published: "true", access_token: t.pageToken })
    : await form(FB, `/${t.pageId}/feed`, { message: text, access_token: t.pageToken });

  if (res.error) return { status: res.uncertain ? "unknown" : "error", error: errOf(res) };
  const id = String(res.post_id || res.id || "");
  if (!id) return { status: "unknown", error: "Facebook нийтлэлийн ID буцаасангүй. Сувгаа шалгана уу." };
  return { status: "ok", externalId: id, permalink: id ? `https://www.facebook.com/${id}` : undefined };
}

export async function publishInstagram(t: MetaTarget, caption: string, imageUrl?: string, videoUrl?: string): Promise<Attempt> {
  if (!imageUrl && !videoUrl) {
    return { status: "error", error: "Instagram-д зураг заавал шаардлагатай (текст ганцаараа явахгүй)." };
  }
  const token = t.igToken;
  const igLogin = token.startsWith("IGAA");
  const base = igLogin ? IG_LOGIN : FB;
  const node = igLogin ? "me" : t.igId;
  if (!token || !node) {
    return { status: "error", error: "Instagram бизнес акаунт холбогдоогүй байна." };
  }

  const container = await form(base, `/${node}/media`, { ...(videoUrl ? { media_type: "REELS", video_url: videoUrl, share_to_feed: "true" } : { image_url: imageUrl! }), caption, access_token: token });
  if (container.error) return { status: "error", error: errOf(container) };
  const creationId = String(container.id || "");
  if (!creationId) return { status: "error", error: "Instagram container үүсгэж чадсангүй." };

  // Meta fetches the image asynchronously — publishing before FINISHED fails.
  let ready = false;
  for (let i = 0; i < (videoUrl ? 45 : 15); i++) {
    const s = await read(base, creationId, "status_code,status", token);
    const code = String(s.status_code || "");
    if (code === "FINISHED") { ready = true; break; }
    if (s.error || code === "ERROR" || code === "EXPIRED") {
      return { status: "error", error: `Instagram зургийг боловсруулж чадсангүй: ${String(s.status || "ERROR")}` };
    }
    await sleep(2000);
  }

  if (!ready) return { status: "error", error: "Instagram медиа боловсруулж дууссангүй. Нийтлээгүй байна." };
  const pub = await form(base, `/${node}/media_publish`, { creation_id: creationId, access_token: token });
  if (pub.error) return { status: pub.uncertain ? "unknown" : "error", error: errOf(pub) };
  const mediaId = String(pub.id || "");
  if (!mediaId) return { status: "unknown", error: "Instagram нийтлэлийн ID буцаасангүй. Сувгаа шалгана уу." };
  const meta = mediaId ? await read(base, mediaId, "permalink", token) : {};
  return { status: "ok", externalId: mediaId, permalink: (meta.permalink as string) || undefined };
}

export async function publishThreads(
  text: string,
  imageUrl?: string,
  threadsUserId?: string,
  opts: ThreadsPostOptions = {},
  videoUrl?: string
): Promise<Attempt> {
  const client = await getThreadsClient(threadsUserId);
  if (!client) {
    return { status: "error", error: "Threads холбогдоогүй эсвэл дахин холбох шаардлагатай." };
  }
  // Refuse loudly at the daily cap. Without this the post just never appears
  // and the failure is indistinguishable from a dead token.
  const room = await client.publishingHeadroom();
  if (room.postsLeft <= 0) {
    return { status: "error", error: "Threads-ийн 24 цагийн нийтлэлийн хязгаар (250) дүүрсэн байна." };
  }
  try {
    const pub = await client.publishPost(text, imageUrl, opts, videoUrl);
    const id = String((pub as J).id || "");
    let permalink: string | undefined;
    try {
      permalink = await client.getPermalink(id);
    } catch {
      /* permalink is cosmetic — a published post without one is still success */
    }
    return { status: "ok", externalId: id, permalink };
  } catch (e) {
    return { status: e instanceof Error && e.name === "PublishUncertain" ? "unknown" : "error", error: e instanceof Error ? e.message : "Threads нийтлэхэд алдаа" };
  }
}

// ── Fan-out ───────────────────────────────────────────────────────────────

export type PublishOutcome = Attempt & { platform: SocialPlatform; ms: number };

export type PublishInput = {
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  platforms: SocialPlatform[];
  metaAccount?: string;
  threadsUserId?: string;
  /** Optional per-network text; falls back to `text`. */
  overrides?: Partial<Record<SocialPlatform, string>>;
  /** Threads-only container options (link card, reply control, topic tag). */
  threads?: ThreadsPostOptions;
};

export async function publishToAll(input: PublishInput, onResult?: (result: PublishOutcome) => Promise<void>): Promise<PublishOutcome[]> {
  const wanted = PLATFORMS.filter((p) => input.platforms.includes(p));
  const needsMeta = wanted.some((p) => p === "facebook" || p === "instagram");
  const target = needsMeta ? await metaTargetFor(input.metaAccount) : null;

  const run = async (p: SocialPlatform): Promise<PublishOutcome> => {
    const started = Date.now();
    const body = textFor(input, p);
    let attempt: Attempt;
    try {
      if (p === "threads") {
        attempt = await publishThreads(body, input.imageUrl, input.threadsUserId, input.threads || {}, input.videoUrl);
      } else if (!target) {
        attempt = { status: "error", error: "Facebook хуудас холбогдоогүй байна." };
      } else if (p === "facebook") {
        attempt = await publishFacebook(target, body, input.imageUrl, input.videoUrl);
      } else {
        attempt = await publishInstagram(target, body, input.imageUrl, input.videoUrl);
      }
    } catch (e) {
      attempt = { status: "error", error: e instanceof Error ? e.message : String(e) };
    }
    const result = { ...attempt, platform: p, ms: Date.now() - started };
    if (onResult) await onResult(result);
    return result;
  };

  return Promise.all(wanted.map(run));
}

// Meta's documented hosted-Reel upload flow. Once finish is accepted, never
// repeat it automatically: Facebook may still be processing the same video.
async function publishFacebookReel(t: MetaTarget, description: string, videoUrl: string): Promise<Attempt> {
  const created = await form(FB, `/${t.pageId}/video_reels`, { upload_phase: "start", access_token: t.pageToken });
  if (created.error) return { status: "error", error: errOf(created) };
  const id = String(created.video_id || "");
  let upload: URL;
  try { upload = new URL(String(created.upload_url)); } catch { return { status: "error", error: "Reel upload URL алга" }; }
  if (!id || upload.protocol !== "https:" || upload.hostname !== "rupload.facebook.com") return { status: "error", error: "Reel upload URL буруу" };
  const uploaded = await gj(upload.href, { method: "POST", headers: { Authorization: `OAuth ${t.pageToken}`, file_url: videoUrl } });
  if (uploaded.error || uploaded.success !== true) return { status: "error", error: errOf(uploaded) || "Видео хүлээн аваагүй" };
  const finished = await form(FB, `/${t.pageId}/video_reels`, { upload_phase: "finish", video_id: id, video_state: "PUBLISHED", description, access_token: t.pageToken });
  const permalink = `https://www.facebook.com/reel/${id}`;
  if (finished.error) return { status: finished.uncertain ? "unknown" : "error", externalId: finished.uncertain ? id : undefined, permalink, error: errOf(finished) };
  if (finished.success !== true) return { status: "unknown", externalId: id, permalink, error: "Facebook-ээс баталгаатай хариу ирсэнгүй. Reel-ээ шалгана уу." };
  for (let i = 0; i < 20; i++) {
    const result = await read(FB, id, "status", t.pageToken);
    const status = (result.status || {}) as J;
    if ((status.publishing_phase as J)?.status === "complete") return { status: "ok", externalId: id, permalink };
    if (status.video_status === "error") return { status: "error", error: "Facebook видео боловсруулахад алдаа гарлаа." };
    await sleep(2000);
  }
  return { status: "unknown", externalId: id, permalink, error: "Facebook хүлээн авсан, боловсруулж байна. Давхар илгээхгүйгээр Reel холбоосоо шалгана уу." };
}
