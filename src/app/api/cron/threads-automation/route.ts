import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { getThreadsAccounts, getAdminSession } from "@/lib/adminAuth";
import type { ThreadsAPI } from "@/lib/threads";
import ThreadsTrigger, { IThreadsTrigger } from "@/models/ThreadsTrigger";
import ThreadsAutoReplyLog from "@/models/ThreadsAutoReplyLog";
import ThreadsPostState from "@/models/ThreadsPostState";
import ThreadsLead from "@/models/ThreadsLead";
import type { IThreadsToken } from "@/models/ThreadsToken";
import { getThreadsSettings } from "@/models/ThreadsSettings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── EVENT SOURCE ASSUMPTION ──────────────────────────────────────────────
// The Threads API has no public webhooks for likes/comments, so this engine
// POLLS (cron every 5 min): comments via /{post}/replies, likes via per-post
// insights count deltas (the API never exposes WHO liked — like events have
// no username). Idempotency = one ThreadsAutoReplyLog row per event id.
// ─────────────────────────────────────────────────────────────────────────

// Events older than this on first sight are "seeded" (seen, never answered) —
// prevents mass-replying to a backlog the first time automation runs.
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
// Hard cap per account per run, on top of the hourly budget.
const MAX_SENDS_PER_RUN = 15;
const POSTS_TO_SCAN = 25;
const LIKE_POSTS_TO_SCAN = 10; // insights = 1 API call per post — keep small
const THANK_YOU_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 thank-you per post per day

interface ThreadsReply { id: string; text?: string; username?: string; timestamp?: string }
interface ThreadsPost { id: string; text?: string; has_replies?: boolean; timestamp?: string }

// ── Conditions ──
function keywordMatch(text: string, t: IThreadsTrigger): boolean {
  if (t.matchMode === "any") return true;
  const hay = t.caseSensitive ? text : text.toLowerCase();
  return t.keywords.some((kw) => {
    const needle = t.caseSensitive ? kw : kw.toLowerCase();
    if (!needle) return false;
    if (t.matchMode === "exact") return hay.trim() === needle.trim();
    if (t.matchMode === "starts_with") return hay.trimStart().startsWith(needle);
    return hay.includes(needle);
  });
}

function excluded(text: string, t: IThreadsTrigger): boolean {
  if (!t.excludeKeywords?.length) return false;
  const hay = text.toLowerCase();
  return t.excludeKeywords.some((kw) => kw && hay.includes(kw.toLowerCase()));
}

// Active-hours window in Asia/Ulaanbaatar (UTC+8). from === to → always on.
function inActiveWindow(t: IThreadsTrigger): boolean {
  const from = t.activeFrom ?? 0;
  const to = t.activeTo ?? 0;
  if (from === to) return true;
  const hour = (new Date().getUTCHours() + 8) % 24;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

// Trigger scope: all posts | one post id | posts whose text contains #hashtag.
function scopeMatch(post: ThreadsPost, t: IThreadsTrigger): boolean {
  if (!t.scope || t.scope === "all") return true;
  if (t.scope === "post") return post.id === t.scopeValue.trim();
  const tag = t.scopeValue.trim().replace(/^#/, "").toLowerCase();
  return !!tag && (post.text || "").toLowerCase().includes(`#${tag}`);
}

async function isFirstTimeEngager(username: string): Promise<boolean> {
  if (!username) return false;
  const prior = await ThreadsAutoReplyLog.findOne({ username }).select("_id").lean();
  return !prior;
}

function render(template: string, vars: { username?: string; count?: number }): string {
  return template
    .replace(/\{\{\s*username\s*\}\}/gi, vars.username ? `@${vars.username}` : "")
    .replace(/\{\{\s*count\s*\}\}/gi, vars.count != null ? String(vars.count) : "")
    .trim();
}

// ── Failure contract ──
// 429/5xx → exponential backoff on the account; auth errors → reconnect_needed
// (pauses everything for that account until re-auth). Anything else: log & skip.
async function recordSendFailure(token: IThreadsToken, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/oauth|session|access token|code.?190|expired/i.test(msg)) {
    token.status = "reconnect_needed";
    await token.save();
    return "reconnect";
  }
  if (/429|rate.?limit|too many|temporarily|unknown error|server error|5\d\d/i.test(msg)) {
    token.failCount = (token.failCount || 0) + 1;
    const delayMs = Math.min(5 * 60_000 * 2 ** (token.failCount - 1), 6 * 60 * 60_000);
    token.backoffUntil = new Date(Date.now() + delayMs);
    await token.save();
    return "backoff";
  }
  return "error";
}

async function recordSendSuccess(token: IThreadsToken) {
  if (token.failCount || token.backoffUntil) {
    token.failCount = 0;
    token.backoffUntil = undefined;
    await token.save();
  }
}

// ── ACTION executor (only API-supported actions: reply, internal lead log) ──
async function executeAction(opts: {
  client: ThreadsAPI;
  token: IThreadsToken;
  trigger: IThreadsTrigger;
  replyToId: string; // comment id (comment) or post id (like thank-you)
  eventType: "comment" | "like";
  eventKey: string;
  postId: string;
  username: string;
  eventText: string;
  count?: number;
}): Promise<"sent" | "error" | "backoff"> {
  const { client, token, trigger, replyToId, eventType, eventKey, postId, username, eventText, count } = opts;
  const wantsReply = trigger.action === "reply" || trigger.action === "reply_and_log" || !trigger.action;
  const wantsLead = trigger.action === "log_lead" || trigger.action === "reply_and_log";

  let sentText = "";
  try {
    if (wantsReply && trigger.replyTemplate) {
      const pool = [trigger.replyTemplate, ...(trigger.replyVariations || [])].filter(Boolean);
      const tpl = pool[Math.floor(Math.random() * pool.length)] || trigger.replyTemplate;
      sentText = render(tpl, { username, count });
      if (sentText) await client.createAndPublish(sentText, replyToId);
    }
    if (wantsLead && username) {
      await ThreadsLead.create({
        accountId: token.threadsUserId, username, label: trigger.leadLabel || "lead",
        sourcePostId: postId, commentText: eventText.slice(0, 500),
        triggerId: trigger._id, triggerName: trigger.name,
      });
    }
    await ThreadsAutoReplyLog.create({
      replyId: eventKey, eventType, accountId: token.threadsUserId, postId,
      username, replyText: eventText.slice(0, 500), status: "sent",
      triggerId: trigger._id, triggerName: trigger.name,
      actionTaken: trigger.action || "reply", sentText: sentText.slice(0, 500),
    });
    await ThreadsTrigger.updateOne({ _id: trigger._id }, { $inc: { hitCount: 1 }, $set: { lastFiredAt: new Date() } });
    await recordSendSuccess(token);
    return "sent";
  } catch (err) {
    const kind = await recordSendFailure(token, err);
    await ThreadsAutoReplyLog.create({
      replyId: eventKey, eventType, accountId: token.threadsUserId, postId,
      username, replyText: eventText.slice(0, 500), status: "error",
      triggerId: trigger._id, triggerName: trigger.name,
      actionTaken: trigger.action || "reply",
      error: err instanceof Error ? err.message : "send failed",
    }).catch(() => {}); // malformed event must never crash the worker
    return kind === "error" ? "error" : "backoff";
  }
}

async function runAccount(
  client: ThreadsAPI,
  token: IThreadsToken,
  triggers: IThreadsTrigger[],
  hourlyBudget: number
) {
  const stats = { scanned: 0, sent: 0, seeded: 0, skipped: 0, errors: 0 };
  let budget = Math.min(hourlyBudget, MAX_SENDS_PER_RUN);
  if (budget <= 0) return { ...stats, reason: "rate_limited" };

  const commentTriggers = triggers.filter((t) => (t.triggerType || "new_comment") === "new_comment");
  const likeTriggers = triggers.filter((t) => t.triggerType === "new_like");

  let selfUsername = "";
  try {
    const me = await client.getProfile();
    selfUsername = (me?.username || "").toLowerCase();
    if (me?.username && token.username !== me.username) {
      token.username = me.username;
      await token.save();
    }
  } catch { /* non-fatal */ }

  const now = Date.now();
  let posts: ThreadsPost[] = [];
  try {
    const threads = await client.getThreads(POSTS_TO_SCAN);
    posts = threads?.data || [];
  } catch (err) {
    await recordSendFailure(token, err);
    return { ...stats, reason: "fetch_failed" };
  }

  // ── new_comment events ──
  if (commentTriggers.length) {
    outer: for (const post of posts) {
      if (!post.has_replies) continue;
      let replies: ThreadsReply[] = [];
      try {
        const r = await client.getReplies(post.id);
        replies = r?.data || [];
      } catch { continue; } // malformed/unfetchable → skip, never crash

      for (const reply of replies) {
        if (!reply?.id) continue;
        stats.scanned++;
        if (selfUsername && (reply.username || "").toLowerCase() === selfUsername) continue;

        // Idempotency — one row per event id, never reply twice.
        const seen = await ThreadsAutoReplyLog.findOne({ replyId: reply.id }).select("_id").lean();
        if (seen) continue;

        const text = reply.text || "";
        const replyTime = reply.timestamp ? new Date(reply.timestamp).getTime() : now;
        if (now - replyTime > LOOKBACK_MS) {
          await ThreadsAutoReplyLog.create({
            replyId: reply.id, eventType: "comment", accountId: token.threadsUserId,
            postId: post.id, username: reply.username || "", replyText: text.slice(0, 500), status: "seeded",
          }).catch(() => {});
          stats.seeded++;
          continue;
        }

        // TRIGGER + CONDITIONS
        let matched: IThreadsTrigger | undefined;
        for (const t of commentTriggers) {
          if (!scopeMatch(post, t)) continue;
          if (!inActiveWindow(t)) continue;
          if (!keywordMatch(text, t)) continue;
          if (excluded(text, t)) continue;
          if (t.firstTimeOnly && !(await isFirstTimeEngager(reply.username || ""))) continue;
          matched = t;
          break;
        }
        if (!matched) {
          await ThreadsAutoReplyLog.create({
            replyId: reply.id, eventType: "comment", accountId: token.threadsUserId,
            postId: post.id, username: reply.username || "", replyText: text.slice(0, 500), status: "skipped",
          }).catch(() => {});
          stats.skipped++;
          continue;
        }

        if (budget <= 0) break outer; // left unlogged → retried next run
        const res = await executeAction({
          client, token, trigger: matched, replyToId: reply.id, eventType: "comment",
          eventKey: reply.id, postId: post.id, username: reply.username || "", eventText: text,
        });
        if (res === "sent") { stats.sent++; budget--; }
        else { stats.errors++; if (res === "backoff") break outer; }
      }
    }
  }

  // ── new_like events (insights count delta; API exposes no liker identity) ──
  if (likeTriggers.length && budget > 0 && token.status === "active") {
    for (const post of posts.slice(0, LIKE_POSTS_TO_SCAN)) {
      const relevant = likeTriggers.filter((t) => scopeMatch(post, t) && inActiveWindow(t));
      if (!relevant.length) continue;

      let likes = 0;
      try {
        interface InsightMetric { name: string; values?: { value?: number }[]; total_value?: { value?: number } }
        const ins = await client.getThreadInsights(post.id);
        const metric = ((ins?.data || []) as InsightMetric[]).find((m) => m.name === "likes");
        likes = metric?.values?.[0]?.value ?? metric?.total_value?.value ?? 0;
      } catch { continue; }

      const state = await ThreadsPostState.findOne({ accountId: token.threadsUserId, postId: post.id });
      if (!state) {
        // First sight = seed the baseline, never fire on the backlog.
        await ThreadsPostState.create({
          accountId: token.threadsUserId, postId: post.id, likes,
          postText: (post.text || "").slice(0, 200), lastCheckedAt: new Date(),
        }).catch(() => {});
        continue;
      }
      if (likes > state.likes) {
        const eventKey = `like:${post.id}:${likes}`;
        const seen = await ThreadsAutoReplyLog.findOne({ replyId: eventKey }).select("_id").lean();
        if (!seen && budget > 0) {
          // Guardrail: at most one thank-you per post per 24h.
          const recent = await ThreadsAutoReplyLog.findOne({
            postId: post.id, eventType: "like", status: "sent",
            createdAt: { $gt: new Date(now - THANK_YOU_COOLDOWN_MS) },
          }).select("_id").lean();
          if (!recent) {
            const res = await executeAction({
              client, token, trigger: relevant[0], replyToId: post.id, eventType: "like",
              eventKey, postId: post.id, username: "", eventText: `+${likes - state.likes} шинэ лайк (нийт ${likes})`,
              count: likes,
            });
            if (res === "sent") { stats.sent++; budget--; } else stats.errors++;
          }
        }
      }
      state.likes = likes;
      state.lastCheckedAt = new Date();
      await state.save().catch(() => {});
    }
  }

  return stats;
}

async function runAutomation() {
  const settings = await getThreadsSettings();
  if (settings.killSwitch) return { ok: true, killed: true, scanned: 0, sent: 0 };

  const triggers = await ThreadsTrigger.find({ enabled: true }).sort({ createdAt: 1 });
  if (triggers.length === 0) return { ok: true, reason: "no_triggers", scanned: 0, sent: 0 };

  const accounts = await getThreadsAccounts();
  if (accounts.length === 0) return { ok: false, reason: "not_connected", scanned: 0, sent: 0 };

  const totals = { ok: true, scanned: 0, sent: 0, seeded: 0, skipped: 0, errors: 0, accounts: 0 };
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  for (const { token, client } of accounts) {
    if (token.backoffUntil && token.backoffUntil > new Date()) continue; // cooling down

    const mine = triggers.filter((t) => !t.threadsUserId || t.threadsUserId === token.threadsUserId);
    if (!mine.length) continue;

    const sentThisHour = await ThreadsAutoReplyLog.countDocuments({
      accountId: token.threadsUserId, status: "sent", createdAt: { $gt: hourAgo },
    });
    const budget = (settings.maxPerHour || 30) - sentThisHour;

    const s = await runAccount(client, token, mine, budget);
    totals.scanned += s.scanned; totals.sent += s.sent; totals.seeded += s.seeded;
    totals.skipped += s.skipped; totals.errors += s.errors; totals.accounts++;
  }
  return totals;
}

async function authorized(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const expected = process.env.CRON_SECRET;
  if (expected && url.searchParams.get("secret") === expected) return true;
  const session = await getAdminSession(); // powers the "Run now" button
  return !!session;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  try {
    const result = await runAutomation();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "automation failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const POST = GET;
