import { sync, accountInfo, primaryTarget } from "@/lib/socialInsights";
import { syncThreads, snapshot, threadsFollowers } from "@/lib/socialThreads";
import { syncAll } from "@/lib/competitors";

/* Бүх сувгийг нэг дор шинэчилнэ: IG + FB + Threads (өөрийн) + өрсөлдөгчид +
   өдрийн дагагчийн snapshot. AI суралцалт (learn) энд ОРОХГҮЙ — тэр нь
   өдөрт нэг (cron ?learn=1), энэ нь 6 цаг тутам. */
export async function refreshAll() {
  const [meta, threads, competitors] = await Promise.all([
    sync(),
    syncThreads(),
    syncAll().catch((e) => ({ error: (e as Error).message })),
  ]);
  const t = await primaryTarget();
  const [acc, th] = await Promise.all([t ? accountInfo(t) : Promise.resolve([]), threadsFollowers()]);
  await snapshot([...acc.map((a) => ({ platform: a.platform, followers: a.followers, posts: a.posts })), { platform: "threads", followers: th.followers }]);
  return { meta, threads, competitors };
}
