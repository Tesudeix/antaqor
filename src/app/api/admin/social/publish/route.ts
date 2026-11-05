import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { randomUUID } from "crypto";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import SocialPost from "@/models/SocialPost";
import { PLATFORMS, validate, scheduleDate, type SocialPlatform } from "@/lib/socialInput";
import { runSocialPost, savedInput } from "@/lib/socialRun";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const result = (doc: InstanceType<typeof SocialPost>) => NextResponse.json({ ok: doc.state === "scheduled" || doc.state === "draft" || doc.results.some(r => r.status === "ok"), id: String(doc._id), scheduled: doc.state === "scheduled", scheduledAt: doc.scheduledAt, state: doc.state, results: doc.results });

export async function GET(req: NextRequest) {
  if (!await getAdminSession()) return unauthorized();
  await dbConnect();
  const raw = Number(req.nextUrl.searchParams.get("limit") || 30);
  const limit = Number.isFinite(raw) ? Math.max(1, Math.min(Math.floor(raw), 50)) : 30;
  const [posts, scheduled, drafts] = await Promise.all([
    SocialPost.find({ state: { $nin: ["draft", "scheduled", "publishing"] } }).sort({ createdAt: -1 }).limit(limit).lean(),
    SocialPost.find({ state: { $in: ["scheduled", "publishing"] } }).sort({ scheduledAt: 1 }).limit(50).lean(),
    SocialPost.find({ state: "draft" }).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  return NextResponse.json({ posts, scheduled, drafts });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return fail("Хүсэлтийн формат буруу");
  const draft = body.action === "draft";
  const platforms = PLATFORMS.filter(p => Array.isArray(body.platforms) && body.platforms.includes(p));
  const overrides: Partial<Record<SocialPlatform, string>> = {};
  for (const p of PLATFORMS) if (typeof body.overrides?.[p] === "string") overrides[p] = body.overrides[p].trim();
  const replies = ["everyone", "accounts_you_follow", "mentioned_only"];
  const data = {
    text: String(body.text || "").trim(), imageUrl: String(body.imageUrl || "").trim(), videoUrl: String(body.videoUrl || "").trim(),
    brief: String(body.brief || "").slice(0, 3000), platforms, overrides,
    metaAccount: String(body.metaAccount || ""), threadsUserId: String(body.threadsUserId || ""),
    threads: { linkUrl: /^https:\/\//i.test(String(body.threads?.linkUrl || "")) ? String(body.threads.linkUrl) : "",
      topicTag: String(body.threads?.topicTag || "").replace(/^#/, "").slice(0, 40),
      replyControl: replies.includes(body.threads?.replyControl) ? body.threads.replyControl : "" },
    createdByEmail: session.user?.email || "",
  };
  if (!draft) {
    const problems = validate(data);
    if (platforms.some(p => p !== "threads") && !data.metaAccount) problems.push("Facebook / Instagram аккаунтаа сонгоно уу.");
    if (platforms.includes("threads") && !data.threadsUserId) problems.push("Threads аккаунтаа сонгоно уу.");
    if (problems.length) return fail(problems.join(" "));
  } else if (!data.text && !data.brief && !data.imageUrl && !data.videoUrl) return fail("Хадгалах контент алга");
  let when: Date | null = null;
  if (!draft) { try { when = scheduleDate(body.scheduledAt); } catch (e) { return fail((e as Error).message); } }
  await dbConnect();
  const id = String(body.draftId || "");
  if (id && !isValidObjectId(id)) return fail("Нооргийн ID буруу");
  const requestKey = typeof body.requestKey === "string" && /^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey) ? body.requestKey : randomUUID();
  if (!draft) { const existing = await SocialPost.findOne({ requestKey }); if (existing) return result(existing); }
  const fields = { ...data, state: draft ? "draft" : when ? "scheduled" : "publishing", scheduledAt: when, ...(draft ? {} : { requestKey }), results: [], lastError: "" };
  let doc;
  try {
    doc = id ? await SocialPost.findOneAndUpdate({ _id: id, state: "draft" }, { $set: fields }, { new: true }) : await SocialPost.create(fields);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) { const existing = await SocialPost.findOne({ requestKey }); if (existing) return result(existing); }
    throw e;
  }
  if (!doc) return fail("Ноорог өөрчлөгдсөн эсвэл аль хэдийн нийтлэгдсэн байна. Жагсаалтаа шинэчилнэ үү.", 409);
  if (draft || when) return result(doc);
  return result(await runSocialPost(doc));
}

export async function PATCH(req: NextRequest) {
  if (!await getAdminSession()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const platform = PLATFORMS.find(p => p === body.platform);
  if (!isValidObjectId(id) || !platform) return fail("Нийтлэл болон суваг сонгоно уу");
  await dbConnect();
  const original = await SocialPost.findById(id);
  if (!original) return fail("Нийтлэл олдсонгүй", 404);
  if (!original.platforms.includes(platform) || original.results.find(r => r.platform === platform)?.status !== "error") return fail("Зөвхөн алдаа нь баталгаажсан сувгийг дахин илгээх боломжтой.", 409);
  const problems = validate(savedInput(original, [platform]));
  if (problems.length) return fail(problems.join(" "));
  const doc = await SocialPost.findOneAndUpdate({ _id: id, state: { $in: ["failed", "published"] }, results: { $elemMatch: { platform, status: "error" } } }, { $set: { state: "publishing" }, $inc: { attempts: 1 } }, { new: true });
  if (!doc) return fail("Энэ нийтлэлийг боловсруулж байна. Түр хүлээнэ үү.", 409);
  const finished = await runSocialPost(doc, [platform]);
  const outcome = finished.results.find(r => r.platform === platform);
  return NextResponse.json({ ok: outcome?.status === "ok", result: outcome });
}

// Cancelling a scheduled job preserves the content as an editable draft.
export async function DELETE(req: NextRequest) {
  if (!await getAdminSession()) return unauthorized();
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!isValidObjectId(id)) return fail("ID буруу");
  await dbConnect();
  const doc = await SocialPost.findOneAndUpdate({ _id: id, state: "scheduled" }, { $set: { state: "draft", scheduledAt: null }, $unset: { requestKey: 1 } }, { new: true });
  if (!doc) return fail("Товлолт олдсонгүй эсвэл нийтэлж эхэлсэн байна.", 409);
  return NextResponse.json({ ok: true });
}
