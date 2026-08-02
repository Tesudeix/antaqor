import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import { REACTION_ORDER, ReactionKey, normalizeReactions } from "@/lib/reactions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await dbConnect();
    const post = await Post.findById(id).lean<{
      reactions?: Record<string, unknown[]>;
      likes?: unknown[];
    }>();
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const rawReactions: Record<string, string[]> = {};
    if (post.reactions) {
      for (const [k, arr] of Object.entries(post.reactions)) {
        rawReactions[k] = (arr || []).map((u) => String(u));
      }
    }
    if (post.likes && post.likes.length > 0) {
      const existing = rawReactions["love"] || [];
      const merged = [...existing];
      for (const u of post.likes) {
        const id = String(u);
        if (!merged.includes(id)) merged.push(id);
      }
      rawReactions["love"] = merged;
    }

    const normalized = normalizeReactions(rawReactions);

    const idSet = new Set<string>();
    for (const k of REACTION_ORDER) for (const u of normalized[k]) idSet.add(u);

    const users = await User.find({ _id: { $in: Array.from(idSet) } })
      .select("_id name avatar")
      .lean<{ _id: unknown; name: string; avatar?: string }[]>();

    const userMap = new Map<string, { _id: string; name: string; avatar?: string }>();
    for (const u of users) {
      userMap.set(String(u._id), { _id: String(u._id), name: u.name, avatar: u.avatar });
    }

    const reactors: Record<ReactionKey, { _id: string; name: string; avatar?: string }[]> = {
      like: [], love: [], fire: [], idea: [], haha: [], celebrate: [],
    };
    for (const k of REACTION_ORDER) {
      for (const uid of normalized[k]) {
        const u = userMap.get(uid);
        if (u) reactors[k].push(u);
      }
    }

    return NextResponse.json({ reactors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load reactors";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
