import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import InstagramPost from "@/models/InstagramPost";
import SiteSettings from "@/models/SiteSettings";

const IG_GRAPH_URL = "https://graph.instagram.com";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getIgToken(): Promise<string | null> {
  const setting = await SiteSettings.findOne({ key: "instagram_token" });
  return setting?.value || null;
}

async function fetchAndCacheFromIG() {
  const token = await getIgToken();
  if (!token) return null;

  // Fetch recent media from Instagram Graph API
  const url = `${IG_GRAPH_URL}/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&limit=20&access_token=${token}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("Instagram API error:", err);
    return null;
  }

  const data = await res.json();
  const posts = data.data || [];

  // Upsert into MongoDB
  for (const post of posts) {
    await InstagramPost.findOneAndUpdate(
      { igId: post.id },
      {
        igId: post.id,
        mediaType: post.media_type === "REELS" ? "REEL" : post.media_type,
        mediaUrl: post.media_url || "",
        thumbnailUrl: post.thumbnail_url || "",
        permalink: post.permalink,
        caption: post.caption || "",
        timestamp: new Date(post.timestamp),
        fetchedAt: new Date(),
      },
      { upsert: true, new: true }
    );
  }

  return posts.length;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get("refresh") === "1";
    const limit = Math.min(parseInt(searchParams.get("limit") || "12"), 50);
    const type = searchParams.get("type"); // VIDEO, REEL, IMAGE, or null for all

    // Check if we need to refresh cache
    const latest = await InstagramPost.findOne().sort({ fetchedAt: -1 });
    const needsRefresh =
      refresh ||
      !latest ||
      Date.now() - latest.fetchedAt.getTime() > CACHE_TTL;

    if (needsRefresh) {
      await fetchAndCacheFromIG();
    }

    // Query cached posts
    const query: Record<string, unknown> = {};
    if (type === "reels") {
      query.mediaType = { $in: ["VIDEO", "REEL"] };
    } else if (type === "images") {
      query.mediaType = "IMAGE";
    }

    const posts = await InstagramPost.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ posts, count: posts.length });
  } catch (err) {
    console.error("Instagram fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
