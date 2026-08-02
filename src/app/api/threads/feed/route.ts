import { NextResponse } from "next/server";
import { getThreadsClient } from "@/lib/adminAuth";

// Public Threads feed for the homepage social section. Reads the same
// ThreadsToken the admin integration maintains (auto-refreshed there).
// Module-level cache keeps us far under the Threads API rate limits.

interface ThreadsPost {
  id: string;
  text: string;
  permalink: string;
  timestamp: string;
  mediaType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}

interface RawThread {
  id: string;
  media_product_type?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  text?: string;
  timestamp?: string;
  thumbnail_url?: string;
  is_quote_post?: boolean;
}

const TTL = 10 * 60 * 1000; // 10 minutes
let cache: { posts: ThreadsPost[]; at: number } | null = null;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL) {
      return NextResponse.json(
        { posts: cache.posts, count: cache.posts.length },
        { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
      );
    }

    const client = await getThreadsClient();
    if (!client) {
      return NextResponse.json({ posts: [], count: 0 });
    }

    const data = (await client.getThreads(16)) as { data?: RawThread[] };
    const posts: ThreadsPost[] = (data.data || [])
      .filter((t) => t.permalink && (t.text || t.media_url))
      .map((t) => ({
        id: t.id,
        text: t.text || "",
        permalink: t.permalink!,
        timestamp: t.timestamp || "",
        mediaType: t.media_type || "TEXT",
        mediaUrl: t.media_url,
        thumbnailUrl: t.thumbnail_url,
      }));

    cache = { posts, at: Date.now() };

    return NextResponse.json(
      { posts, count: posts.length },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    // Serve stale cache on API hiccups rather than blanking the section
    return NextResponse.json({ posts: cache?.posts || [], count: cache?.posts.length || 0 });
  }
}
