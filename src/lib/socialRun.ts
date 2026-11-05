import SocialPost, { type ISocialPost } from "@/models/SocialPost";
import { publishToAll, type PublishInput, type SocialPlatform } from "@/lib/socialPublish";

export function savedInput(doc: ISocialPost, platforms = doc.platforms): PublishInput {
  return { text: doc.text, imageUrl: doc.imageUrl || undefined, videoUrl: doc.videoUrl || undefined,
    platforms: platforms as SocialPlatform[], metaAccount: doc.metaAccount || undefined,
    threadsUserId: doc.threadsUserId || undefined, overrides: doc.overrides || {},
    threads: doc.threads as PublishInput["threads"] };
}
// A publishing row is claimed before this function runs. Persist every network
// result independently; a process interruption must never replay successful posts.
export async function runSocialPost(doc: ISocialPost, platforms = doc.platforms) {
  const input = savedInput(doc, platforms);
  const waiting = platforms.map(platform => ({ platform, status: "unknown", externalId: "", permalink: "", error: "Илгээж байна. Үр дүн баталгаажаагүй.", ms: 0, at: new Date() }));
  await SocialPost.updateOne({ _id: doc._id, state: "publishing" }, { $set: { results: [...doc.results.filter(r => !platforms.includes(r.platform)), ...waiting] } });
  try {
    await publishToAll(input, async result => {
      await SocialPost.updateOne({ _id: doc._id }, { $set: { "results.$[r]": { ...result, at: new Date() } } }, { arrayFilters: [{ "r.platform": result.platform }] });
    });
  } catch {
    // DB failure or a process boundary: unresolved rows retain unknown, never
    // a false success or an automatic retry with duplicate external side effects.
  }
  const latest = await SocialPost.findById(doc._id);
  if (!latest) throw new Error("Нийтлэлийн бүртгэл олдсонгүй");
  latest.state = latest.results.length === latest.platforms.length && latest.results.every(r => r.status === "ok") ? "published" : "failed";
  latest.lastError = latest.results.filter(r => r.status !== "ok").map(r => `${r.platform}: ${r.error}`).join(" · ");
  await latest.save();
  return latest;
}
