// ─── Лайк → кредит (2026-09-02) ──────────────────────────────────────────
// ONE place for "did this post just cross a like milestone, pay the author".
// Called by BOTH /api/posts/[id]/like (legacy `likes` array) and
// /api/posts/[id]/react (the `reactions` map the feed actually uses).
//
// Rules:
//  • `likesPerCredit` (default 10) reactions/likes from OTHER people = 1 step;
//    each step pays `likeMilestoneCredits` (default 1). Both live in
//    SiteSettings, edited at /admin/ai-images. 0 credits = feature off.
//  • `Post.likeMilestonesAwarded` only moves FORWARD, one step per event —
//    toggling a reaction off and on at the threshold cannot re-earn, and a
//    legacy post with 57 likes catches up 1₵ per new like, never 5₵ at once.
//  • Daily caps in `awardCredits` (DAILY_CAPS.LIKE_RECEIVED, CREDITS_PER_DAY)
//    still apply on top.

import { awardCredits } from "@/lib/credits";
import { loadImagePricing } from "@/lib/imagePricingServer";
import { notifyUser } from "@/lib/notifications";
import { pushToUser } from "@/lib/push";

interface PostLike {
  _id: { toString(): string };
  author: { toString(): string };
  likes?: { toString(): string }[];
  reactions?: Map<string, unknown[]> | Record<string, unknown[]>;
  likeMilestonesAwarded?: number;
  save: () => Promise<unknown>;
  markModified?: (path: string) => void;
}

/** Distinct people (excluding the author) who liked or reacted. */
export function countSupporters(post: PostLike): number {
  const author = post.author.toString();
  const ids = new Set<string>();
  for (const l of post.likes || []) {
    const s = l.toString();
    if (s !== author) ids.add(s);
  }
  const r = post.reactions;
  if (r) {
    const entries: unknown[][] = r instanceof Map ? Array.from(r.values()) : Object.values(r);
    for (const list of entries) {
      for (const u of list || []) {
        const s = String(u);
        if (s !== author) ids.add(s);
      }
    }
  }
  return ids.size;
}

/**
 * Check the milestone AFTER the post has been saved with the new like/react.
 * Persists the advanced counter itself. Best-effort: never throws.
 */
export async function maybeAwardLikeMilestone(post: PostLike): Promise<{ awarded: number; milestone: number } | null> {
  try {
    const pricing = await loadImagePricing().catch(() => null);
    const per = pricing?.likesPerCredit || 10;
    const amount = pricing?.likeMilestoneCredits ?? 1;
    if (amount <= 0) return null;

    const supporters = countSupporters(post);
    const milestone = Math.floor(supporters / per);
    const already = post.likeMilestonesAwarded || 0;
    if (milestone <= already) return null;

    const next = already + 1;
    post.likeMilestonesAwarded = next;
    await post.save();

    const authorId = post.author.toString();
    const res = await awardCredits({
      userId: authorId,
      reason: "LIKE_RECEIVED",
      credits: amount,
      ref: `${post._id}:${next}`,
      meta: { postId: String(post._id), milestone: next, supporters, per },
    }).catch(() => null);
    if (!res || res.awarded <= 0) return null;

    const title = `+${res.awarded} кредит · ${supporters} лайк`;
    const message = `Пост чинь ${next * per} лайкийн босгыг давлаа. Үлдэгдэл: ${res.balance} кредит — AI зураг үүсгэхэд ашиглаарай.`;
    notifyUser({ userId: authorId, type: "system", title, message, link: "/credits" }).catch(() => {});
    pushToUser(authorId, { title, body: "Лайк → кредит. AI зураг үүсгэхэд ашиглаарай.", url: "/content-agent?v=image", tag: `like-credit-${post._id}-${next}` }).catch(() => {});
    return { awarded: res.awarded, milestone: next };
  } catch (e) {
    console.error("[likeCredits] milestone failed:", e);
    return null;
  }
}
