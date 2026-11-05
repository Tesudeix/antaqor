import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { REACTION_ORDER, REACTIONS, ReactionKey, legacyToCanonical, normalizeReactions } from "@/lib/reactions";
import { sendPushToUser } from "@/lib/push-server";
import { maybeAwardLikeMilestone } from "@/lib/likeCredits";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const { emoji } = await req.json();
    const target = typeof emoji === "string" ? legacyToCanonical(emoji) : null;
    if (!target) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (!post.reactions) {
      post.reactions = new Map();
    }

    // Toggle: if user already used `target`, remove it. Otherwise remove from any other key first, then add.
    const rawCurrent: Record<string, string[]> = {};
    for (const [k, v] of post.reactions.entries()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rawCurrent[k] = (v as any[]).map((u) => String(u));
    }
    const normalized = normalizeReactions(rawCurrent);
    const alreadyOnTarget = normalized[target].includes(userId);

    // Wipe user from all canonical keys
    for (const k of REACTION_ORDER) {
      normalized[k] = normalized[k].filter((u) => u !== userId);
    }
    if (!alreadyOnTarget) {
      normalized[target].push(userId);
    }

    // Persist: replace the reactions map with only canonical keys
    post.reactions.clear();
    for (const k of REACTION_ORDER) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      post.reactions.set(k, normalized[k] as any);
    }
    post.markModified("reactions");
    await post.save();

    // Лайк → кредит: шинэ (toggle-off биш, өөрийнх биш) react бүр босгыг шалгана.
    if (!alreadyOnTarget && String(post.author) !== userId) {
      await maybeAwardLikeMilestone(post);
    }

    // Push to post author when someone NEW reacts (not when toggling off, not when reacting to your own post).
    // Fire-and-forget so the response isn't blocked.
    if (!alreadyOnTarget) {
      const authorId = String(post.author);
      if (authorId !== userId) {
        (async () => {
          try {
            const reactor = await User.findById(userId).select("name").lean<{ name?: string }>();
            const reactorName = reactor?.name || "Хэн нэгэн";
            const r = REACTIONS[target];
            const title = `${reactorName} ${r.label} react хийсэн`;
            const body = post.content?.slice(0, 80) || "Таны постонд.";
            const link = `/posts/${post._id}`;
            // Persist in-app + push
            await Notification.create({
              recipient: post.author,
              type: "system",
              title,
              message: body,
              link,
              read: false,
            });
            await sendPushToUser(authorId, { title, body, url: link, tag: `react-${post._id}` });
          } catch (e) {
            console.error("[react] notify author failed:", e);
          }
        })();
      }
    }

    const reactionCounts: Record<ReactionKey, { count: number; reacted: boolean }> = {
      like: { count: 0, reacted: false },
      love: { count: 0, reacted: false },
      fire: { count: 0, reacted: false },
      idea: { count: 0, reacted: false },
      haha: { count: 0, reacted: false },
      celebrate: { count: 0, reacted: false },
    };
    for (const k of REACTION_ORDER) {
      reactionCounts[k] = { count: normalized[k].length, reacted: normalized[k].includes(userId) };
    }

    const userReaction: ReactionKey | null = alreadyOnTarget ? null : target;

    return NextResponse.json({ reactions: reactionCounts, userReaction });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to react";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
