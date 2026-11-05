import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import MetaConversation, { MetaPlatform } from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import MetaSettings from "@/models/MetaSettings";
import MetaTrigger, { IMetaTrigger } from "@/models/MetaTrigger";
import MetaWelcome from "@/models/MetaWelcome";
import PostReply from "@/models/PostReply";
import { findMatchingTrigger, renderTemplate } from "@/lib/metaTriggers";
import { accountForPageId, ensurePageRegistry, isRegisteredPage, type MetaAccount } from "@/lib/metaAccounts";
import { generateReply, ChatTurn } from "@/lib/metaAI";
import { antaqorAgentReply } from "@/lib/antaqorAgent";
import { sendDm, sendButtonTemplate, sendGenericTemplate, sendImageAttachment, QuickReply } from "@/lib/metaDm";
import { sendPrivateReplyToComment, replyToComment, likeComment } from "@/lib/metaComment";
import { getOrCreateUserForPartner, tryHandleCommand, wantsHuman } from "@/lib/metaCommands";
import { fetchPartnerProfile } from "@/lib/metaProfile";
import { scoreIntent } from "@/lib/metaIntent";
import { enrollInNurture, stopEnrollmentsForConversation } from "@/lib/metaNurture";
import { checkSafety } from "@/lib/metaSafety";
import { startFunnel, advanceFunnel, cancelFunnel, alertHotLead, isFunnelExit } from "@/lib/metaFunnel";
import { findMatchingFlow, findMainFlow, startFlow, handleFlowPostback, resendCurrentCard, exitCurrentFlow } from "@/lib/metaFlowRun";
import { findMatchingSocialFlow, startSocialFlow, handleSocialFlowPostback } from "@/lib/socialFlowRun";
import { processCommentForBots, handleOrderDm, handleOrderPostback } from "@/lib/orderBot";
import { getMemo, memoToContext, updateMemoFromTurn } from "@/lib/metaMemory";
import { getConciergeConfig, conciergeTurn } from "@/lib/concierge";

const AI_DISCLOSURE_PREFIX = "🤖 ";
const AI_DISCLOSURE_FOOTER = "";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const APP_SECRETS = (process.env.META_APP_SECRETS || process.env.META_APP_SECRET || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const SELF_IDS = (process.env.META_SELF_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const AI_HISTORY_DEPTH = 6;
// A human handoff nobody answered should not mute the bot forever.
const ESCALATION_TTL_MS = 12 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && token && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    console.warn("[meta/webhook] bad signature");
    return new Response("bad signature", { status: 401 });
  }
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  void handlePayload(payload).catch((err) =>
    console.error("[meta/webhook] handler error", err)
  );
  return NextResponse.json({ received: true });
}

function verifySignature(rawBody: string, header: string | null): boolean {
  if (!APP_SECRETS.length || !header) return false;
  for (const secret of APP_SECRETS) {
    const expected =
      "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (
      header.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected))
    ) {
      return true;
    }
  }
  return false;
}

interface WebhookPayload {
  object?: string;
  entry?: Array<WebhookEntry>;
}
interface WebhookEntry {
  id?: string;
  time?: number;
  messaging?: Array<MessagingEvent>;
  changes?: Array<ChangeEvent>;
}
interface MessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
  };
  postback?: { payload?: string; title?: string };
}
interface ChangeEvent {
  field?: string;
  value?: {
    id?: string;
    comment_id?: string;
    text?: string;
    message?: string;
    item?: string;
    verb?: string;
    post_id?: string;
    from?: { id?: string; username?: string };
    media?: { id?: string };
    parent_id?: string;
  };
}

async function handlePayload(payload: WebhookPayload) {
  await dbConnect();
  await ensurePageRegistry();
  const platform: MetaPlatform =
    payload.object === "instagram" ? "instagram" : "messenger";

  for (const entry of payload.entry || []) {
    const entryId = (entry as { id?: string }).id;
    /* Салгасан / бүртгэлгүй хуудас — ЧИМЭЭГҮЙ ОРХИНО.
       Үүнгүй бол `accountForPageId` нь "antaqor" буцааж, өөр брэндийн
       үйлчлүүлэгч Antaqor-ийн боттой ярилцаж эхэлнэ. */
    if (!isRegisteredPage(entryId)) {
      console.log("[meta/route]", platform, "entryId=" + (entryId || "?"), "-> БҮРТГЭЛГҮЙ, алгасав");
      continue;
    }
    const account = accountForPageId(entryId);
    console.log("[meta/route]", platform, "entryId=" + (entryId || "?"), "->", account);
    for (const ev of entry.messaging || []) {
      // Postback / quick reply takes priority over plain text
      const postbackPayload = ev.postback?.payload || ev.message?.quick_reply?.payload;
      if (postbackPayload && ev.sender?.id) {
        // Quick replies carry the tapped label in message.text; postbacks
        // carry it in postback.title. Pass whichever exists as the title.
        const title = ev.postback?.title || ev.message?.text;
        await handlePostback(platform, account, ev.sender.id, postbackPayload, title).catch((e) =>
          console.error("[meta/webhook] postback handler", e)
        );
        continue;
      }
      await handleMessagingEvent(platform, account, ev).catch((e) =>
        console.error("[meta/webhook] dm handler", e)
      );
    }
    if ((entry.changes || []).length || (entry.messaging || []).length) {
      console.log(
        "[meta/shape]",
        platform,
        "messaging=" + (entry.messaging || []).length,
        "changes=" + JSON.stringify((entry.changes || []).map((c) => ({
          field: c.field,
          keys: Object.keys((c.value || {}) as Record<string, unknown>),
        })))
      );
    }
    for (const ch of entry.changes || []) {
      if (ch.field === "comments" || ch.field === "feed") {
        await handleCommentEvent(platform, account, ch).catch((e) =>
          console.error("[meta/webhook] comment handler", e)
        );
      }
    }
  }
}

async function handleMessagingEvent(platform: MetaPlatform, account: MetaAccount, ev: MessagingEvent) {
  const senderId = ev.sender?.id;
  const text = ev.message?.text?.trim();
  if (ev.message?.is_echo) {
    /* Page inbox-оос эзэн гараар бичсэн (манай app-аас биш) echo → агент 20 мин чимээгүй. */
    const aid = String((ev.message as { app_id?: number | string }).app_id || "");
    const ours = process.env.META_FB_APP_ID || "";
    if (platform === "messenger" && aid && ours && aid !== ours && ev.recipient?.id) {
      await MetaConversation.updateOne({ partnerId: ev.recipient.id, platform }, { $set: { humanAt: new Date() } }).catch(() => {});
    }
    return;
  }
  if (!senderId || !text) return;
  if (SELF_IDS.includes(senderId)) return;

  const user = await getOrCreateUserForPartner(platform, senderId);
  const conv = await upsertConversation(platform, senderId, text, user._id.toString(), account);

  // Dedup by mid
  if (ev.message?.mid) {
    const existed = await MetaMessage.findOne({ mid: ev.message.mid }).lean();
    if (existed) return;
  }

  // Background: fetch profile + score intent (don't block reply)
  void ensureProfile(platform, conv._id.toString(), senderId);
  void scoreAndStoreIntent(conv._id.toString(), text);

  // Persist incoming
  await MetaMessage.create({
    conversationId: conv._id,
    platform,
    direction: "in",
    source: "user",
    text,
    mid: ev.message?.mid,
  });

  // BROADCAST OPT-OUT — honour STOP / unsubscribe keywords. Sets the flag the
  // broadcast engine checks before ever including this person in a send, then
  // acknowledges. Runs before commands/triggers/AI so "зогс" always opts out.
  if (/^(зогс|зогсоо|болих|stop|unsubscribe|татгалзах)$/i.test(text)) {
    await MetaConversation.findByIdAndUpdate(conv._id, { broadcastOptOut: true }).catch(() => {});
    await sendAndPersist(
      platform, senderId, conv._id.toString(),
      "Та сурталчилгааны мессежээс татгалзлаа 🙏 Дахин хүсвэл бидэнд хэдийд ч бичээрэй.", "ai"
    ).catch(() => {});
    return;
  }

  // SAFETY GATE — distress / violence signals
  // Fires BEFORE commands/triggers/AI. Provides crisis resources, halts AI
  // permanently for this conversation, flags for admin attention.
  const safety = checkSafety(text);
  if (safety.shouldHaltAI && safety.replyText) {
    await MetaConversation.findByIdAndUpdate(conv._id, {
      aiDisabled: true,
      escalatedToHuman: true,
      escalatedAt: new Date(),
      safetyFlag: safety.flag,
    });
    console.warn("[meta/webhook] SAFETY_FLAG", safety.flag, "conv", conv._id.toString());
    await sendAndPersist(platform, senderId, conv._id.toString(), safety.replyText, "ai");
    return;
  }

  // Escalated to a human → stay silent, but never permanently. Antaqor's
  // RESUME commands only run for the antaqor account, so for every other
  // tenant one tap of "Хүнтэй ярих" killed the bot for that customer for good
  // and the lead was silently lost. Two escape hatches: the customer asks for
  // the bot back, or the handoff goes unanswered past ESCALATION_TTL_MS.
  if (conv.escalatedToHuman) {
    const asksForBot = /^(эхлүүл|үргэлжлүүл|resume|start|бот|bot|дахин эхэл)\b/i.test(text.trim());
    const since = conv.escalatedAt ? Date.now() - new Date(conv.escalatedAt).getTime() : Infinity;
    if (!asksForBot && since < ESCALATION_TTL_MS) return;
    await MetaConversation.findByIdAndUpdate(conv._id, {
      escalatedToHuman: false,
      aiDisabled: false,
      escalatedAt: null,
    });
    conv.escalatedToHuman = false;
    conv.aiDisabled = false;
    console.log("[meta/webhook] escalation cleared", asksForBot ? "(customer asked)" : "(expired)", conv._id.toString());
  }

  // MASTER AUTOMATION SWITCH — when an admin turns automation off, the bot
  // goes silent and every incoming DM is left for a human (admin inbox).
  // Safety + already-escalated checks above still run regardless.
  const master = await MetaSettings.findOne(
    { singleton: "main" },
    "automationEnabled"
  ).lean<{ automationEnabled?: boolean }>();
  if (master?.automationEnabled === false) return;

  // PER-ACCOUNT AUTOMATION GATE — silence the bot for pages whose welcome config
  // is disabled (e.g. joybilliard). Inbound is already persisted above, so the
  // message still appears in the human inbox; we just send nothing.
  if (await accountAutomationDisabled(account)) return;

  // HUMAN HANDOFF (typed) — "talk to human" / "хүнтэй ярих" / "operator" etc.
  // Mirrors the MENU_HUMAN quick-reply button: escalate, acknowledge, alert the
  // admin. Runs before triggers/AI/welcome so it always works, on any account.
  const ccfg = await getConciergeConfig().catch(() => null);
  const conciergeOn = !!(ccfg?.enabled && account === "antaqor" && (platform === "messenger" || ccfg.includeInstagram));
  if (!conciergeOn && wantsHuman(text)) {
    await MetaConversation.findByIdAndUpdate(conv._id, {
      escalatedToHuman: true,
      aiDisabled: true,
      escalatedAt: new Date(),
    });
    await sendAndPersist(
      platform,
      senderId,
      conv._id.toString(),
      "Таныг хүнтэй холболоо 🙋 Манай ажилтан удахгүй хариулна, түр хүлээнэ үү.",
      "ai"
    );
    void alertHotLead(
      "human",
      { _id: String(conv._id), platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
      { "Хүсэлт": "Хүнтэй ярих (бичсэн)" }
    ).catch((e) => console.error("[meta] human alert", e));
    return;
  }

  // MID-FLOW LOCK (Flow Builder) — the contact is parked on a flow card. Typed
  // text here is "unknown input mid-flow": re-prompt the SAME card and stop, so
  // it never falls through to brand-mention AI / triggers / Default Reply (the
  // root of the "fires on every inbound event" bug). Button taps don't reach
  // here — they arrive as postbacks via handlePostback. An exit keyword bails
  // out cleanly; a vanished card (flow edited) releases the lock and falls
  // through to normal handling.
  const af = (conv as unknown as { activeFlow?: { flowId: string; nodeId: string } | null }).activeFlow;
  if (af?.flowId) {
    if (isFunnelExit(text)) {
      await exitCurrentFlow(conv._id.toString(), af.flowId);
    } else {
      const stillInFlow = await resendCurrentCard(platform, account, senderId, conv._id.toString(), af);
      if (stillInFlow) return;
    }
  }

  // CHAT АГЕНТ (/admin/concierge) — асаалттай үед хуучин цэс/товч/автомат хариуг
  // бүгдийг алгасаж, хүн шиг ярилцана. Эзний гараар бүтээсэн богино keyword урсгал л үлдэнэ.
  if (conciergeOn && ccfg && !conv.aiDisabled) {
    const freshC = await MetaConversation.findById(conv._id, "funnel").lean<{ funnel?: { name?: string } }>();
    if (!freshC?.funnel?.name) {
      if (text.length <= 24) {
        const kwSocial = await findMatchingSocialFlow(text, platform, account);
        if (kwSocial) { await startSocialFlow(kwSocial, { platform, account, partnerId: senderId, conversationId: conv._id.toString(), lastText: text }); return; }
        const kwFlow = await findMatchingFlow(text, platform, account);
        if (kwFlow) { await startFlow(platform, account, senderId, conv._id.toString(), kwFlow); return; }
        const kwTrig = await findMatchingTrigger(text, "dm", platform, account);
        if (kwTrig) { await fireDmTrigger(platform, account, senderId, conv._id.toString(), kwTrig); return; }
      }
      await MetaConversation.updateOne({ _id: conv._id }, { $set: { welcomeMenuSent: true } });
      const cid = conv._id.toString();
      void conciergeTurn({
        platform, account, senderId, convId: cid, mid: ev.message?.mid, text,
        partnerName: conv.partnerName, cfg: ccfg, userCtx: buildUserContext(user),
        send: async (t) => {
          let out = t;
          if (ccfg.disclosure) {
            const d = await MetaConversation.findById(cid, "disclosureSent").lean<{ disclosureSent?: boolean }>();
            if (!d?.disclosureSent) { out = `AI туслах: ${t}`; await MetaConversation.findByIdAndUpdate(cid, { disclosureSent: true }); }
          }
          await sendAndPersist(platform, senderId, cid, out, "ai");
        },
        handoff: async (why) => {
          await MetaConversation.findByIdAndUpdate(cid, { escalatedToHuman: true, aiDisabled: true, escalatedAt: new Date() });
          await alertHotLead("human", { _id: cid, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName }, { "Хүсэлт": "Агент танд шилжүүлсэн", "Шалтгаан": why, "Мессеж": text.slice(0, 200) }).catch((e) => console.error("[concierge] alert", e));
        },
      }).catch((e) => console.error("[concierge] turn", e));
      return;
    }
  }

  // ANTAQOR AGENT — a brand mention triggers the platform's agentic AI on ANY
  // connected page (joymassage / joybilliard / antaqor / future pages), grounded
  // in live DB data. Skips when mid-funnel or AI is turned off.
  if (!conv.aiDisabled && /antaqor|антакор/i.test(text)) {
    const freshF = await MetaConversation.findById(conv._id, "funnel").lean<{ funnel?: { name?: string } }>();
    const agentSettings = await MetaSettings.findOne({ singleton: "main" });
    if (!freshF?.funnel?.name && (!agentSettings || agentSettings.aiReplyEnabled !== false)) {
      const history = await loadHistory(conv._id.toString());
      const memo = await getMemo(conv._id.toString());
      let reply = await antaqorAgentReply(text, history, buildUserContext(user) + memoToContext(memo));
      if (!conv.disclosureSent) {
        reply = `${AI_DISCLOSURE_PREFIX}${reply}`;
        await MetaConversation.findByIdAndUpdate(conv._id, { disclosureSent: true });
      }
      await sendAndPersist(platform, senderId, conv._id.toString(), reply, "ai", [
        { label: "Захиалах 📅", payload: "MENU_BOOK" },
        { label: "Хүнтэй ярих 🙋", payload: "MENU_HUMAN" },
      ]);
      void updateMemoFromTurn(conv._id.toString(), text, reply);
      return;
    }
  }

  // Идэвхтэй ЗАХИАЛГЫН session энэ яриаг эзэмшинэ — алхмаа үргэлжлүүлнэ.
  if (await handleOrderDm(platform, conv._id.toString(), text)) return;

  // FIRST-TOUCH WELCOME — once per conversation. Atomic claim so two
  // near-simultaneous DMs don't both fire. Behaviour (menu / flow / off) is
  // admin-configurable per account via MetaWelcome.welcomeMode; runWelcome
  // sets disclosureSent for the menu path to preserve the original flow.
  // runWelcome returns false when it stays silent (welcomeMode "off"): the
  // first message then falls through to normal reactive handling (triggers →
  // FAQ/AI) instead of being swallowed — no proactive greeting, but the
  // customer's actual question still gets answered.
  const claimed = await MetaConversation.findOneAndUpdate(
    { _id: conv._id, welcomeMenuSent: { $ne: true } },
    { $set: { welcomeMenuSent: true } }
  );
  if (claimed) {
    // ManyChat дүрэм: хэрэглэгчийн ЭХНИЙ мессеж keyword-д таарвал
    // welcome menu биш, шууд тухайн automation-ийн хариуг илгээнэ.
    const kwSocial = await findMatchingSocialFlow(text, platform, account);
    if (kwSocial) {
      await startSocialFlow(kwSocial, { platform, account, partnerId: senderId, conversationId: conv._id.toString(), lastText: text });
      return;
    }
    const kwFlow = await findMatchingFlow(text, platform, account);
    if (kwFlow) {
      await startFlow(platform, account, senderId, conv._id.toString(), kwFlow);
      return;
    }
    const kwTrigger = await findMatchingTrigger(text, "dm", platform, account);
    if (kwTrigger) {
      await fireDmTrigger(platform, account, senderId, conv._id.toString(), kwTrigger);
      return;
    }
    const greeted = await runWelcome(platform, account, senderId, conv._id.toString());
    if (greeted) return;
  }

  // FUNNEL — if conversation is mid-funnel, capture this message as the
  // answer to the current step. "handled" → done; "exit" → user bailed,
  // fall through to commands; "none" → no active funnel.
  const ft = await runFunnelTurn(
    platform,
    senderId,
    { _id: conv._id, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
    text
  );
  if (ft === "handled") return;

  // Stop active nurture sequences (if their current step.stopOnReply=true)
  void stopEnrollmentsForConversation(conv._id.toString(), "user_replied");

  // 1. Command path — ANTAQOR ONLY. These are Antaqor's own membership /
  //    credit / account-linking commands. Running them for every tenant leaked
  //    Antaqor into other brands' chats (a REVA shopper typing "тусламж" got
  //    "холбох <код> — Antaqor бүртгэлээ холбох"), and tryHandleCommand also
  //    calls wantsHuman, which escalated ordinary shopper phrases to a human.
  if (account === "antaqor") {
    const cmd = await tryHandleCommand(text, user, conv._id.toString());
    if (cmd) {
      await sendAndPersist(platform, senderId, conv._id.toString(), cmd.text, "ai");
      return;
    }
  }

  // 1a-sf. SOCIAL FLOW (визуал builder) — шинэ систем хамгийн түрүүнд гүйнэ.
  const sfMatch = await findMatchingSocialFlow(text, platform, account);
  if (sfMatch) {
    await startSocialFlow(sfMatch, { platform, account, partnerId: senderId, conversationId: conv._id.toString(), lastText: text });
    return;
  }

  // 1b. FLOW BUILDER — admin-authored branching flow, keyword-matched. Runs
  // before legacy DM triggers so flows take precedence. Stateless: each card's
  // buttons carry the next card id in their postback payload (see metaFlowRun).
  const flowMatch = await findMatchingFlow(text, platform, account);
  if (flowMatch) {
    await startFlow(platform, account, senderId, conv._id.toString(), flowMatch);
    return;
  }

  // 2. DM-side trigger
  const trigger = await findMatchingTrigger(text, "dm", platform, account);
  if (trigger) {
    await fireDmTrigger(platform, account, senderId, conv._id.toString(), trigger);
    return;
  }

  // 2b. DEFAULT RESPONSE (no keyword match) — admin-configurable per account
  // via MetaWelcome.defaultAction. "smart" (default) preserves the original
  // behaviour: business → menu, antaqor → AI. runDefaultAction returns true
  // when it fully handled the message; false means "fall through to AI".
  const handledDefault = await runDefaultAction(
    platform,
    account,
    { _id: conv._id, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
    text
  );
  if (handledDefault) return;

  // 3. AI auto-reply  (reached only when the default resolves to AI)
  if (conv.aiDisabled) return;
  const settings = await MetaSettings.findOne({ singleton: "main" });
  if (!settings || !settings.aiReplyEnabled) return;

  const lc = text.toLowerCase();
  if (settings.blacklistWords?.some((w) => w && lc.includes(w.toLowerCase()))) {
    console.log("[meta/webhook] blacklisted");
    return;
  }

  if (settings.businessHoursEnabled) {
    const inHours = isWithinBusinessHours(
      settings.businessHoursStartMin,
      settings.businessHoursEndMin,
      settings.businessHoursTz
    );
    if (!inHours) {
      if (settings.businessHoursMessage) {
        await sendAndPersist(platform, senderId, conv._id.toString(), settings.businessHoursMessage, "ai");
      }
      return;
    }
  }

  if (settings.maxRepliesPerUserPerDay > 0) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const count = await MetaMessage.countDocuments({
      conversationId: conv._id,
      direction: "out",
      source: "ai",
      createdAt: { $gte: start },
    });
    if (count >= settings.maxRepliesPerUserPerDay) {
      console.log("[meta/webhook] rate limit hit");
      return;
    }
  }

  // Load message history for AI memory
  const history = await loadHistory(conv._id.toString());
  const memo = await getMemo(conv._id.toString());
  const userContext = buildUserContext(user) + memoToContext(memo);
  const gen = await generateReply(text, settings, userContext, history);
  let replyText = gen.ok ? gen.text : settings.fallbackMessage;
  if (!gen.ok) console.error("[meta/webhook] gen failed", (gen as { error: string }).error);

  // AI DISCLOSURE — required on first AI reply per conversation (Meta TOS + MN law)
  if (!conv.disclosureSent) {
    replyText = `${AI_DISCLOSURE_PREFIX}${replyText}${AI_DISCLOSURE_FOOTER}`;
    await MetaConversation.findByIdAndUpdate(conv._id, { disclosureSent: true });
  }

  await sendAndPersist(platform, senderId, conv._id.toString(), replyText, "ai");

  // Background memo update — extract/merge running notes about this user.
  // Fire-and-forget; never blocks reply latency.
  void updateMemoFromTurn(conv._id.toString(), text, replyText);
}

async function handlePostback(
  platform: MetaPlatform,
  account: MetaAccount,
  senderId: string,
  payload: string,
  title?: string
) {
  if (SELF_IDS.includes(senderId)) return;

  const user = await getOrCreateUserForPartner(platform, senderId);
  const conv = await upsertConversation(platform, senderId, title || `[btn] ${payload}`, user._id.toString(), account);

  // FUNNEL_OPT — user tapped a suggested answer chip during a funnel.
  // Record the tapped label as their answer and run the funnel turn.
  if (payload === "FUNNEL_OPT") {
    const answer = (title || "").trim();
    if (answer) {
      await MetaMessage.create({
        conversationId: conv._id,
        platform,
        direction: "in",
        source: "user",
        text: answer,
      });
      const ft = await runFunnelTurn(
        platform,
        senderId,
        { _id: conv._id, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
        answer
      );
      if (ft === "handled") return;
    }
    // No active funnel / exited → fall through to normal handling.
  }

  await MetaMessage.create({
    conversationId: conv._id,
    platform,
    direction: "in",
    source: "user",
    text: title ? `[btn] ${title}` : `[btn] ${payload}`,
  });

  // PER-ACCOUNT AUTOMATION GATE — disabled pages send nothing (button tap logged).
  if (await accountAutomationDisabled(account)) return;

  // FLOW BUILDER navigation — "flow:<id>:<cardId>" jumps to the next card;
  // "flowact:<id>:<action>" runs an action. nav/end are handled inside;
  // human/subscribe are escalated/acknowledged here.
  // ЗАХИАЛГЫН товчнууд — ord:p/q/ok/edit
  if (payload.startsWith("ord:")) {
    if (await handleOrderPostback(platform, conv._id.toString(), payload)) return;
  }

  // SOCIAL FLOW товчнууд — sf:<flowId>:<nodeId>:<optionId>
  if (payload.startsWith("sf:")) {
    const sfHandled = await handleSocialFlowPostback(platform, account, senderId, conv._id.toString(), payload, title);
    if (sfHandled) return;
  }

  if (payload.startsWith("flow:") || payload.startsWith("flowact:") || payload.startsWith("flowjump:")) {
    const fr = await handleFlowPostback(platform, account, senderId, conv._id.toString(), payload);
    if (fr === "nav" || fr === "end") return;
    if (fr === "human") {
      await MetaConversation.findByIdAndUpdate(conv._id, { escalatedToHuman: true, escalatedAt: new Date() });
      await sendAndPersist(platform, senderId, conv._id.toString(), "Таныг хүнтэй холболоо 🙋 Манай ажилтан удахгүй хариулна, түр хүлээнэ үү.", "ai");
      void alertHotLead("human", { _id: String(conv._id), platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName }, { "Хүсэлт": "Flow → хүнтэй ярих" }).catch((e) => console.error("[meta] human alert", e));
      return;
    }
    if (fr === "subscribe") {
      await MetaConversation.findByIdAndUpdate(conv._id, { intentLabel: "warm", leadStatus: "contacted" });
      await sendAndPersist(platform, senderId, conv._id.toString(), "Бүртгэлээ! 🎉 Шинэ мэдээ, онцлох санал гарвал танд хамгийн түрүүнд илгээнэ.", "ai");
      return;
    }
    if (fr === "order") {
      // Start the built-in order-capture funnel (item → 8-digit phone → address).
      // Subsequent text replies advance it via runFunnelTurn; on completion the
      // owner gets a tidy lead summary through alertHotLead.
      const start = await startFunnel(conv._id.toString(), "order");
      if (start.ok && start.firstQuestion) {
        await sendAndPersist(platform, senderId, conv._id.toString(), start.firstQuestion, "ai");
      }
      return;
    }
    if (fr === "pay") {
      // Send the shop's bank/QPay details (set in Тавтай морил → Төлбөр).
      // QR goes first as a native-ratio image, then the account number as
      // long-pressable copyable text. Mongolia = bank transfer / QPay, not cards.
      const w = await MetaWelcome.findOne({ account }).select("payQrUrl payText").lean<{ payQrUrl?: string; payText?: string }>();
      if (w?.payQrUrl) await sendImageAttachment(platform, senderId, w.payQrUrl, { account }).catch((e) => console.error("[meta] pay qr", e));
      const payText = (w?.payText || "").trim() || "Төлбөрөө дансаар шилжүүлнэ үү. Гүйлгээний утга дээр утасны дугаараа бичээрэй. 🙏";
      await sendAndPersist(platform, senderId, conv._id.toString(), payText, "ai");
      return;
    }
  }

  // MENU_INTRO → friend-tone discovery funnel (4 strategic questions)
  // MENU_HR    → HR qualifying funnel (3 questions, hot-lead pipeline)
  // Subsequent user replies are captured in handleMessagingEvent.
  // MENU_HUMAN → escalate to a human agent + alert admin.
  if (payload === "MENU_HUMAN") {
    await MetaConversation.findByIdAndUpdate(conv._id, { escalatedToHuman: true, escalatedAt: new Date() });
    await sendAndPersist(platform, senderId, conv._id.toString(), "Таныг хүнтэй холболоо 🙋 Манай ажилтан удахгүй хариулна, түр хүлээнэ үү.", "ai");
    void alertHotLead("human", { _id: String(conv._id), platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName }, { "Хүсэлт": "Хүнтэй ярих" }).catch((e) => console.error("[meta] human alert", e));
    return;
  }

  const funnelMap: Record<string, string> = {
    MENU_INTRO: "intro",
    MENU_HR: "hr",
    MENU_BOOK: "book",
    MENU_ORDER: "order",
  };
  if (funnelMap[payload]) {
    const start = await startFunnel(conv._id.toString(), funnelMap[payload]);
    if (start.ok && start.firstQuestion) {
      const qr = (start.options || [])
        .slice(0, 6)
        .map((o) => ({ label: o.slice(0, 20), payload: "FUNNEL_OPT" }));
      await sendAndPersist(
        platform,
        senderId,
        conv._id.toString(),
        start.firstQuestion,
        "ai",
        qr.length ? qr : undefined
      );
      return;
    }
  }

  // Other menu options → route through Grok with founder-strategist framing.
  // Memo is injected so Antaqor "remembers" past context from prior DMs.
  const menuPrompts: Record<string, string> = {
    MENU_STRATEGY:
      "2026-д брэнд+бизнес босгох TOP 3 алхмыг нэг өгүүлбэрт нэг алхам — нийт 3 өгүүлбэр. Cool playful, шууд, үйлдэлд хөрвөнө.",
    MENU_EMPIRE:
      "Дижитал эзэнт гүрэн босгох эхний 3 алхам — нэг өгүүлбэрт нэг алхам, нийт 3 өгүүлбэр. Founder өнгө, шуудан.",
  };
  if (menuPrompts[payload]) {
    const settings = await MetaSettings.findOne({ singleton: "main" });
    const memo = await getMemo(conv._id.toString());
    const userCtx = buildUserContext(user) + memoToContext(memo);
    const gen = await generateReply(menuPrompts[payload], settings, userCtx, []);
    const replyText = gen.ok
      ? gen.text
      : settings?.fallbackMessage || "Сайн уу! Түр доголдол гарлаа.";
    if (!gen.ok) console.error("[meta/webhook] menu gen failed", (gen as { error: string }).error);
    await sendAndPersist(platform, senderId, conv._id.toString(), replyText, "ai");
    void updateMemoFromTurn(conv._id.toString(), `[menu: ${payload}]`, replyText);
    return;
  }

  // Conversation-starter tap → treat the suggested question like a typed
  // message: keyword trigger first, otherwise an AI auto-reply.
  if (payload.startsWith("ask:")) {
    const q = payload.slice("ask:".length).trim();
    if (q) {
      const trig = await findMatchingTrigger(q, "dm", platform, account);
      if (trig) {
        await fireDmTrigger(platform, account, senderId, conv._id.toString(), trig);
        return;
      }
      // Route through the account's default action so the answer comes from its
      // OWN knowledge base and voice. The bare generateReply below speaks as
      // "Antaqor, founder of antaqor.com" — wrong for every other tenant.
      const handledAsk = await runDefaultAction(
        platform,
        account,
        { _id: conv._id, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
        q
      );
      if (handledAsk) return;
      const settings = await MetaSettings.findOne({ singleton: "main" });
      const memo = await getMemo(conv._id.toString());
      const gen = await generateReply(q, settings, buildUserContext(user) + memoToContext(memo), []);
      const replyText = gen.ok ? gen.text : (settings?.fallbackMessage || "Сайн уу! Түр хүлээгээд дахин бичээрэй.");
      await sendAndPersist(platform, senderId, conv._id.toString(), replyText, "ai");
      void updateMemoFromTurn(conv._id.toString(), q, replyText);
      return;
    }
  }

  // Payload convention:
  //   "trigger:<oid>" → fire that trigger directly
  //   "cmd:<text>"    → run as if user typed <text>
  //   anything else   → run through tryHandleCommand as text
  if (payload.startsWith("trigger:")) {
    const triggerId = payload.slice("trigger:".length);
    const trigger = await MetaTrigger.findById(triggerId);
    if (trigger && trigger.enabled) {
      await fireDmTrigger(platform, account, senderId, conv._id.toString(), trigger);
      return;
    }
  }

  const cmdText = payload.startsWith("cmd:") ? payload.slice("cmd:".length) : payload;

  // A tapped button carries the ACCOUNT'S OWN vocabulary, so match its triggers
  // before anything else — otherwise "Захиалах" fell straight past them into
  // Antaqor's command handler and answered with the generic help line.
  const btnTrigger = await findMatchingTrigger(cmdText, "dm", platform, account);
  if (btnTrigger) {
    await fireDmTrigger(platform, account, senderId, conv._id.toString(), btnTrigger);
    return;
  }

  if (account === "antaqor") {
    const cmd = await tryHandleCommand(cmdText, user, conv._id.toString());
    if (cmd) {
      await sendAndPersist(platform, senderId, conv._id.toString(), cmd.text, "ai");
      return;
    }
  }

  // Answer from this account's own knowledge base / default action (which for a
  // hot buying phrase starts its order funnel) instead of the old
  // "«тусламж» гэж бичээрэй" line — that word is Antaqor vocabulary and means
  // nothing to another brand's customer.
  const handledBtn = await runDefaultAction(
    platform,
    account,
    { _id: conv._id, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
    cmdText
  );
  if (handledBtn) return;

  await sendAndPersist(platform, senderId, conv._id.toString(), "Боллоо! Юу хиймээр байна? 🙂", "ai");
}

async function handleCommentEvent(platform: MetaPlatform, account: MetaAccount, ch: ChangeEvent) {
  // FB page "feed" fires for posts/likes/edits too — only act on newly added comments.
  if (ch.field === "feed" && !(ch.value?.item === "comment" && (!ch.value?.verb || ch.value?.verb === "add"))) return;
  const text = (ch.value?.message ?? ch.value?.text)?.trim();
  const commentId = ch.value?.comment_id ?? ch.value?.id;
  // Facebook sends post_id; Instagram sends media.id and no post_id at all, so
  // reading only the former left every IG comment with an empty post — which
  // silently disabled per-post scoping and per-post answers on Instagram.
  const postId = ch.value?.post_id || ch.value?.media?.id || "";
  const fromId = ch.value?.from?.id;
  const fromUsername = ch.value?.from?.username;
  if (!text || !commentId || !fromId) return;
  if (SELF_IDS.includes(fromId)) return;

  // PER-ACCOUNT AUTOMATION GATE — disabled pages don't auto-reply to comments.
  if (await accountAutomationDisabled(account)) return;

  // COMMENT-ORDER BOT — нэгдсэн automation эхэлж таарна (dedupe нь дотроо).
  const botHandled = await processCommentForBots(
    platform,
    account,
    { postId, commentId, fromId, fromUsername: fromUsername || "", text },
    async () => {
      const bu = await getOrCreateUserForPartner(platform, fromId, fromUsername);
      return upsertConversation(platform, fromId, `(comment) ${text}`, bu._id.toString(), account);
    }
  );
  if (botHandled) return;

  const trigger = await findMatchingTrigger(text, "comment", platform, account, postId);
  console.log(
    "[meta/comment]", platform, "account=" + account,
    "text=" + JSON.stringify((text || "").slice(0, 40)),
    "commentId=" + (commentId || "-"),
    "->", trigger ? "MATCH " + trigger.name : "no trigger"
  );
  if (!trigger) return;

  // The trigger decided WHEN to answer; a PostReply decides WHAT for this
  // particular post. No row = the trigger's own text, so a page that has not
  // filled anything in keeps working exactly as before.
  const perPost = postId
    ? await PostReply.findOne({ account, postId, enabled: true }).lean<{
        dmText?: string; buttons?: { label: string; url: string }[];
        commentReply?: string; imageUrl?: string;
      } | null>()
    : null;

  const bodyText = (perPost?.dmText || "").trim() || trigger.dmTemplate;
  const rendered = renderTemplate(bodyText, {
    username: fromUsername || "",
    comment: text,
  });
  if (perPost) {
    void PostReply.updateOne(
      { account, postId },
      { $inc: { hitCount: 1 }, $set: { lastFiredAt: new Date() } }
    ).catch(() => {});
    console.log("[meta/comment] per-post answer for", postId);
  }

  const dmRes = await sendPrivateReplyToComment(platform, commentId, rendered, { account });
  if (!dmRes.ok) console.error("[meta/webhook] private reply fail", dmRes.status, dmRes.body);

  // A like is the fastest visible acknowledgement on the post itself, and it
  // survives even when the public reply is refused.
  // A per-post button set replaces the trigger's, so each post can carry its
  // own link. Sent as a follow-up because the private reply above is plain text.
  const btns = (perPost?.buttons?.length ? perPost.buttons : trigger.buttons) || [];
  if (dmRes.ok && btns.length) {
    await sendButtonTemplate(platform, fromId, "👇", btns.slice(0, 3), { account }).catch((e) =>
      console.warn("[meta/webhook] comment buttons fail", e)
    );
  }

  if (trigger.commentLike) {
    const lk = await likeComment(platform, commentId, { account });
    if (!lk.ok) console.warn("[meta/webhook] comment like fail", lk.status, lk.body.slice(0, 160));
  }

  if (trigger.commentReply) {
    // Render the same tokens the DM gets, so a public reply can greet the
    // commenter by name ({{username}}) instead of printing the raw token.
    const publicReply = renderTemplate((perPost?.commentReply || "").trim() || trigger.commentReply, {
      username: fromUsername || "",
      comment: text,
    });
    const cr = await replyToComment(platform, commentId, publicReply, { account });
    if (!cr.ok) console.error("[meta/webhook] comment reply fail", cr.status, cr.body);
  }

  await MetaTrigger.updateOne(
    { _id: trigger._id },
    { $inc: { hitCount: 1 }, $set: { lastFiredAt: new Date() } }
  );

  const user = await getOrCreateUserForPartner(platform, fromId, fromUsername);
  const conv = await upsertConversation(platform, fromId, `(comment) ${text}`, user._id.toString(), account);

  void ensureProfile(platform, conv._id.toString(), fromId);

  await MetaMessage.create({
    conversationId: conv._id,
    platform,
    direction: "in",
    source: "user",
    text: `[comment] ${text}`,
  });
  await MetaMessage.create({
    conversationId: conv._id,
    platform,
    direction: "out",
    source: "trigger",
    text: rendered,
    triggerId: trigger._id,
    errorBody: dmRes.ok ? "" : `${dmRes.status} ${dmRes.body}`.slice(0, 1000),
  });
  if (dmRes.ok) {
    conv.lastMessagePreview = rendered.slice(0, 200);
    conv.lastMessageDirection = "out";
    conv.lastMessageAt = new Date();
    await conv.save();
  }

  if (trigger.enrollNurtureId) {
    void enrollInNurture(trigger.enrollNurtureId, conv._id, platform, fromId);
  }
}

async function fireDmTrigger(
  platform: MetaPlatform,
  account: MetaAccount,
  recipientId: string,
  conversationId: string,
  trigger: IMetaTrigger
) {
  const rendered = renderTemplate(trigger.dmTemplate, { comment: "" });
  const quickReplies: QuickReply[] = (trigger.quickReplies || []).map((q) => ({
    label: q.label,
    payload: q.payload,
  }));

  const btns = (trigger.buttons || []).filter((b) => b?.label && b?.url);
  const cards = (trigger.cards || []).filter((c) => c?.title);
  let send: { ok: boolean; status: number; body: string };
  if (cards.length) {
    if (rendered && rendered.trim()) {
      await sendDm(platform, recipientId, rendered, { account });
    }
    send = await sendGenericTemplate(platform, recipientId, cards, { account });
  } else if (btns.length) {
    send = await sendButtonTemplate(platform, recipientId, rendered, btns, { account });
  } else {
    send = await sendDm(platform, recipientId, rendered, {
      account,
      quickReplies: quickReplies.length ? quickReplies : undefined,
    });
  }
  await MetaMessage.create({
    conversationId,
    platform,
    direction: "out",
    source: "trigger",
    text: rendered,
    triggerId: trigger._id,
    errorBody: send.ok ? "" : `${send.status} ${send.body}`.slice(0, 1000),
  });
  if (send.ok) {
    await MetaConversation.findByIdAndUpdate(conversationId, {
      lastMessagePreview: rendered.slice(0, 200),
      lastMessageDirection: "out",
      lastMessageAt: new Date(),
    });
  }
  await MetaTrigger.updateOne(
    { _id: trigger._id },
    { $inc: { hitCount: 1 }, $set: { lastFiredAt: new Date() } }
  );

  if (trigger.enrollNurtureId) {
    void enrollInNurture(trigger.enrollNurtureId, conversationId, platform, recipientId);
  }
}

// Shared funnel-turn processor used by both plain DMs and quick-reply taps.
// Returns "handled" when the funnel advanced/finished (caller should stop),
// "exit" when the user bailed (caller falls through to commands),
// "none" when there is no active funnel.
async function runFunnelTurn(
  platform: MetaPlatform,
  senderId: string,
  conv: { _id: unknown; platform: MetaPlatform; partnerId: string; partnerName?: string },
  text: string
): Promise<"handled" | "exit" | "none"> {
  const convId = String(conv._id);
  const fresh = await MetaConversation.findById(convId, "funnel").lean<{
    funnel?: { name?: string } | null;
  }>();
  if (!fresh?.funnel?.name) return "none";

  if (isFunnelExit(text)) {
    await cancelFunnel(convId);
    return "exit";
  }

  const step = await advanceFunnel(convId, text);
  if (!step) return "none";

  if (step.done) {
    await sendAndPersist(platform, senderId, convId, step.finalText!, "ai");
    void alertHotLead(
      step.funnelName!,
      { _id: conv._id as string, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
      step.answers!
    ).catch((e) => console.error("[funnel] alert", e));
    void updateMemoFromTurn(convId, text, step.finalText!);
  } else {
    const qr = (step.options || [])
      .slice(0, 6)
      .map((o) => ({ label: o.slice(0, 20), payload: "FUNNEL_OPT" }));
    await sendAndPersist(
      platform,
      senderId,
      convId,
      step.nextQuestion!,
      "ai",
      qr.length ? qr : undefined
    );
  }
  return "handled";
}

async function sendAndPersist(
  platform: MetaPlatform,
  recipientId: string,
  conversationId: string,
  text: string,
  source: "ai" | "manual" | "trigger",
  quickReplies?: { label: string; payload: string }[]
) {
  const cAcc = await MetaConversation.findById(conversationId).select("account").lean<{ account?: string }>();
  const account = (cAcc?.account as MetaAccount) || "antaqor";
  const send = await sendDm(
    platform,
    recipientId,
    text,
    quickReplies && quickReplies.length ? { quickReplies, account } : { account }
  );
  await MetaMessage.create({
    conversationId,
    platform,
    direction: "out",
    source,
    text,
    errorBody: send.ok ? "" : `${send.status} ${send.body}`.slice(0, 1000),
  });
  if (send.ok) {
    await MetaConversation.findByIdAndUpdate(conversationId, {
      lastMessagePreview: text.slice(0, 200),
      lastMessageDirection: "out",
      lastMessageAt: new Date(),
    });
  } else {
    console.error("[meta/webhook] send fail", send.status, send.body);
  }
}

async function upsertConversation(
  platform: MetaPlatform,
  partnerId: string,
  lastPreview: string,
  linkedUserId?: string,
  account: MetaAccount = "antaqor"
) {
  const now = new Date();
  const update: Record<string, unknown> = {
    $set: {
      lastMessagePreview: lastPreview.slice(0, 200),
      lastMessageDirection: "in" as const,
      lastMessageAt: now,
      lastInboundAt: now,
      account,
      ...(linkedUserId ? { linkedUserId } : {}),
    },
    $inc: { unreadCount: 1 },
    $setOnInsert: { platform, partnerId, status: "open" as const, aiDisabled: false },
  };
  return await MetaConversation.findOneAndUpdate(
    { platform, partnerId },
    update,
    { new: true, upsert: true }
  );
}

async function ensureProfile(platform: MetaPlatform, conversationId: string, partnerId: string) {
  try {
    const conv = await MetaConversation.findById(conversationId);
    if (!conv) return;
    // Refetch when core fields are missing OR when we haven't pulled
    // the extended IG signals yet (verified / follow relationship).
    const haveBasics = !!conv.partnerName && !!conv.partnerProfilePic;
    const haveExtras = conv.partnerUsername !== undefined && conv.partnerVerified !== undefined;
    if (haveBasics && haveExtras) return;

    const profile = await fetchPartnerProfile(platform, partnerId);
    if (!profile) return;

    const patch: Record<string, unknown> = {};
    if (profile.name && !conv.partnerName) patch.partnerName = profile.name;
    if (profile.username) {
      if (!conv.partnerUsername) patch.partnerUsername = profile.username;
      if (!conv.partnerName) patch.partnerName = profile.username;
    }
    if (profile.profilePic && !conv.partnerProfilePic) patch.partnerProfilePic = profile.profilePic;
    if (typeof profile.isVerified === "boolean") patch.partnerVerified = profile.isVerified;
    if (typeof profile.followsBusiness === "boolean") patch.partnerFollowsUs = profile.followsBusiness;
    if (typeof profile.businessFollows === "boolean") patch.weFollowPartner = profile.businessFollows;

    if (Object.keys(patch).length > 0) {
      await MetaConversation.findByIdAndUpdate(conversationId, patch);
    }
  } catch (err) {
    console.error("[meta/webhook] profile fetch", err);
  }
}

async function scoreAndStoreIntent(conversationId: string, text: string) {
  try {
    const result = await scoreIntent(text);
    // Funnel completion is a hard buying signal — never let a cold
    // message score bury a lead that finished HR/intro qualification.
    const conv = await MetaConversation.findById(
      conversationId,
      "profile"
    ).lean<{ profile?: Record<string, { completedAt?: unknown }> | null }>();
    let floor = 0;
    let floorLabel: "hot" | "warm" | null = null;
    if (conv?.profile?.hr?.completedAt) {
      floor = 100;
      floorLabel = "hot";
    } else if (conv?.profile?.intro?.completedAt) {
      floor = 60;
      floorLabel = "warm";
    }
    const score = Math.max(result.score, floor);
    const label =
      floorLabel && result.score < floor ? floorLabel : result.label;
    await MetaConversation.findByIdAndUpdate(conversationId, {
      intentScore: score,
      intentLabel: label,
    });
  } catch (err) {
    console.error("[meta/webhook] intent score", err);
  }
}

async function loadHistory(conversationId: string): Promise<ChatTurn[]> {
  // Last AI_HISTORY_DEPTH messages, excluding the just-persisted incoming one
  const messages = await MetaMessage.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(AI_HISTORY_DEPTH + 1)
    .lean();
  // Drop the most recent (it's the current incoming we already pass separately)
  const trimmed = messages.slice(1).reverse();
  return trimmed.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.text,
  }));
}

function buildUserContext(user: {
  name: string;
  credits: number;
  subscriptionExpiresAt?: Date;
  clan?: string;
}): string {
  const days = user.subscriptionExpiresAt
    ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - Date.now()) / 86400_000))
    : 0;
  return [
    `User name: ${user.name}`,
    `Credits: ${user.credits ?? 0}`,
    `Subscription: ${days > 0 ? `${days} days left` : "inactive"}`,
    user.clan ? `Clan: ${user.clan}` : "",
  ].filter(Boolean).join(" · ");
}

// ─────────────────────────────────────────────────────────────────────────
// WELCOME + DEFAULT-RESPONSE ENGINE
// Both the first-touch welcome and the "no keyword matched" fallback are
// admin-configurable per account via MetaWelcome (admin → Automation → Цэс).
// All defaults preserve the original hardcoded behaviour.
// ─────────────────────────────────────────────────────────────────────────

const VALID_FLOWS = new Set(["intro", "hr", "book"]);

// Start a qualifying funnel and send its opening question with tappable chips.
// Mirrors the funnel-start path in handlePostback. Returns false when the
// funnel name is unknown so callers can fall back to the menu.
async function startFunnelAndAsk(
  platform: MetaPlatform,
  senderId: string,
  conversationId: string,
  funnelName: string
): Promise<boolean> {
  if (!VALID_FLOWS.has(funnelName)) return false;
  const start = await startFunnel(conversationId, funnelName);
  if (!start.ok || !start.firstQuestion) return false;
  const qr = (start.options || [])
    .slice(0, 6)
    .map((o) => ({ label: o.slice(0, 20), payload: "FUNNEL_OPT" }));
  await sendAndPersist(platform, senderId, conversationId, start.firstQuestion, "ai", qr.length ? qr : undefined);
  return true;
}

// First-touch welcome. menu → greeting+buttons (mark disclosureSent, as the
// original atomic claim did); flow → auto-start a funnel; off → stay silent.
// Per-account automation kill-switch. When an account's welcome config is
// disabled (MetaWelcome.enabled === false), the bot stays fully silent for that
// page — inbound DMs/comments are still recorded for the human inbox, but no
// automated reply, menu, flow, or AI message is sent. Accounts with no welcome
// doc (or enabled !== false) auto-reply as before. This lets a multi-page
// operator turn the bot off for one business (e.g. joybilliard) without
// touching the others (antaqor). The `enabled` flag was previously dead — set
// in the admin UI but never honoured by the webhook.
async function accountAutomationDisabled(account: MetaAccount): Promise<boolean> {
  const cfg = await MetaWelcome.findOne({ account }).select("enabled").lean<{ enabled?: boolean }>();
  return !!cfg && cfg.enabled === false;
}

// Returns true when a proactive welcome was sent (main flow / funnel / menu),
// false when it stayed silent (welcomeMode "off") so the caller falls through
// to reactive handling instead of swallowing the customer's first message.
async function runWelcome(
  platform: MetaPlatform,
  account: MetaAccount,
  senderId: string,
  conversationId: string
): Promise<boolean> {
  // Main flow takes priority — fires for every first touch when one is enabled.
  const mainMatch = await findMainFlow(platform, account);
  if (mainMatch) {
    await startFlow(platform, account, senderId, conversationId, mainMatch);
    return true;
  }

  const cfg = await MetaWelcome.findOne({ account })
    .select("welcomeMode welcomeFlow")
    .lean<{ welcomeMode?: string; welcomeFlow?: string }>();
  const mode = cfg?.welcomeMode || "menu";

  if (mode === "off") return false;
  if (mode === "flow") {
    const ok = await startFunnelAndAsk(platform, senderId, conversationId, cfg?.welcomeFlow || "intro");
    if (ok) return true;
  }
  // menu (default) — also the fallback when a configured flow name is invalid.
  await sendWelcomeMenu(platform, senderId, conversationId);
  await MetaConversation.findByIdAndUpdate(conversationId, { disclosureSent: true });
  return true;
}

// No-keyword-match default response. Returns true when fully handled; false
// means "let the caller run the normal AI auto-reply path".
// Answer a natural-language question strictly from the account's FAQ knowledge
// base, in the contact's own language (incl. Latin-script Mongolian). Returns
// the answer, or null when the KB doesn't cover it (LLM emits <NO_ANSWER>) so
// the caller can deflect to the menu / human — never the welcome greeting.
async function answerFromKB(text: string, faq: string, convId: string): Promise<string | null> {
  const settings = await MetaSettings.findOne({ singleton: "main" });
  // NOT gated on settings.aiReplyEnabled: that flag governs the open-ended
  // Antaqor agent. A per-account businessFaq is its own explicit opt-in, and a
  // scripted answer out of a knowledge base the owner wrote is a different
  // thing — otherwise one global switch silences every tenant FAQ bot.
  const history = await loadHistory(convId);
  const ctx =
    "Чи энэ бизнесийн туслах. Доорх МЭДЭЭЛЛИЙН САНГ (FAQ) ашиглан хэрэглэгчийн асуултад ШУУД, товч хариул. " +
    "Хэрэглэгчийн бичсэн ХЭЛЭЭР хариул (латин үсгээр бичсэн монгол бол монголоор). " +
    "Хэрэв асуултын хариу мэдээллийн санд БАЙХГҮЙ бол ямар ч тайлбаргүйгээр яг '<NO_ANSWER>' гэж бич. " +
    "Цэс/командын жагсаалт бүү гарга.\n\n=== МЭДЭЭЛЛИЙН САН ===\n" +
    faq.slice(0, 4000);
  // The default persona is "Antaqor, founder of antaqor.com" — the wrong voice
  // for another brand customers, who must never be told they are talking to
  // Antaqor. Speak as the business that owns this knowledge base.
  const kbSettings = {
    ...(settings?.toObject?.() ?? {}),
    systemPromptOverride:
      "Чи энэ бизнесийн албан ёсны чат туслах. Өөрийгөө өөр брэнд, өөр компани " +
      "эсвэл өөр хүн гэж БҮҮ танилцуул. Зөвхөн доорх мэдээллийн санд тулгуурла.",
  } as unknown as typeof settings;
  const r = await generateReply(text, kbSettings, ctx, history);
  if (!r.ok) return null;
  const out = (r.text || "").trim();
  if (!out || out.includes("<NO_ANSWER>")) return null;
  return out;
}

async function runDefaultAction(
  platform: MetaPlatform,
  account: MetaAccount,
  conv: { _id: unknown; platform: MetaPlatform; partnerId: string; partnerName?: string },
  text: string
): Promise<boolean> {
  const convId = String(conv._id);
  const senderId = conv.partnerId;
  const cfg = await MetaWelcome.findOne({ account })
    .select("defaultAction defaultText defaultFlow businessFaq")
    .lean<{ defaultAction?: string; defaultText?: string; defaultFlow?: string; businessFaq?: string }>();

  let action: string = cfg?.defaultAction || "smart";

  // Intent mode — one cheap classifier call picks the concrete route.
  if (action === "intent") {
    const { score, label } = await scoreIntent(text);
    if (label === "support") action = "human";
    else if (score >= 8) action = cfg?.defaultFlow ? "flow" : "menu"; // hot lead → capture
    else if (score >= 5) action = "ai";                                // warm → engage
    else action = "menu";                                              // cold / fan → menu
  }

  // Smart mode preserves the original heuristic.
  if (action === "smart") action = account === "antaqor" ? "ai" : "menu";

  // ANSWER-FIRST: before falling back to the menu OR a generic AI reply, try to
  // actually ANSWER the question from the per-account FAQ knowledge base. This
  // is the fix for the bug where unmatched questions got the welcome menu
  // re-shown (BUG 1) and real FAQ questions got the command list instead of an
  // answer (BUG 2). Runs for the two fallback actions (menu / ai); explicit
  // text/flow/human stay exactly as configured.
  if ((action === "menu" || action === "ai") && (cfg?.businessFaq || "").trim()) {
    const ans = await answerFromKB(text, cfg!.businessFaq!, convId);
    if (ans) {
      await sendAndPersist(platform, senderId, convId, ans, "ai");
      return true;
    }
    // <NO_ANSWER> → fall through to the menu, never to the general AI: that is
    // the Antaqor agent, and answering another brand customer in Antaqor voice
    // is worse than showing them the menu.
    if (action === "ai") action = "menu";
  }

  switch (action) {
    case "ai":
      return false;

    case "text": {
      const msg =
        (cfg?.defaultText || "").trim() ||
        "Сайн уу! 🙌 Доорх цэснээс сонгох, эсвэл асуултаа дэлгэрэнгүй бичээрэй.";
      await sendAndPersist(platform, senderId, convId, msg, "ai");
      return true;
    }

    case "flow": {
      const ok = await startFunnelAndAsk(platform, senderId, convId, cfg?.defaultFlow || "intro");
      if (!ok) await sendWelcomeMenu(platform, senderId, convId);
      return true;
    }

    case "human": {
      await MetaConversation.findByIdAndUpdate(convId, { escalatedToHuman: true, escalatedAt: new Date() });
      await sendAndPersist(
        platform,
        senderId,
        convId,
        "Таныг хүнтэй холболоо 🙋 Манай ажилтан удахгүй хариулна, түр хүлээнэ үү.",
        "ai"
      );
      void alertHotLead(
        "human",
        { _id: convId, platform: conv.platform, partnerId: conv.partnerId, partnerName: conv.partnerName },
        { "Хүсэлт": "Хариу олдоогүй — хүн рүү шилжүүлэв" }
      ).catch((e) => console.error("[meta] default human alert", e));
      return true;
    }

    case "menu":
    default:
      await sendWelcomeMenu(platform, senderId, convId);
      return true;
  }
}

async function sendWelcomeMenu(
  platform: MetaPlatform,
  recipientId: string,
  conversationId: string
) {
  const cAcc = await MetaConversation.findById(conversationId).select("account").lean<{ account?: string }>();
  const account = (cAcc?.account as MetaAccount) || "antaqor";

  let text =
    account === "antaqor"
      ? "Сайн уу 👋 Antaqor AI байна. Юу хайж байна?"
      : "Сайн байна уу! 👋 Танд юугаар туслах вэ? Доороос сонгох, эсвэл асуултаа бичээрэй.";

  // Business pages no longer ship hardcoded Захиалах/Хүнтэй ярих buttons — the
  // menu is fully admin-driven via MetaWelcome (admin → Automation → Цэс).
  // The antaqor brand account keeps its built-in discovery menu.
  let quickReplies: QuickReply[] =
    account === "antaqor"
      ? [
          { label: "Танилцъя", payload: "MENU_INTRO" },
          { label: "Стратеги", payload: "MENU_STRATEGY" },
          { label: "HR агентлаг", payload: "MENU_HR" },
          { label: "Эзэнт гүрэн", payload: "MENU_EMPIRE" },
        ]
      : [];

  // Admin-configured welcome (per account) overrides greeting + buttons when set.
  const wcfg = await MetaWelcome.findOne({ account, enabled: true }).lean<{ greeting?: string; buttons?: { label: string; action: string; value: string }[]; conversationStarters?: string[] }>();
  if (wcfg) {
    if (wcfg.greeting) text = wcfg.greeting;
    if (wcfg.buttons && wcfg.buttons.length) {
      quickReplies = wcfg.buttons.slice(0, 11).map((b) => ({
        label: (b.label || "").slice(0, 20),
        payload:
          b.action === "book" ? "MENU_BOOK"
          : b.action === "human" ? "MENU_HUMAN"
          : b.action === "trigger" ? `trigger:${b.value}`
          : `cmd:${b.value}`,
      }));
    }
    // Conversation starters (ice-breakers) lead the quick replies — tapping one
    // routes the suggested question through triggers / AI (see handlePostback).
    const starterQRs: QuickReply[] = (wcfg.conversationStarters || [])
      .filter((s) => s && s.trim())
      .slice(0, 4)
      .map((s) => ({ label: s.slice(0, 20), payload: `ask:${s.slice(0, 300)}` }));
    if (starterQRs.length) quickReplies = [...starterQRs, ...quickReplies].slice(0, 13);
  }

  const send = await sendDm(
    platform,
    recipientId,
    text,
    quickReplies.length ? { quickReplies, account } : { account }
  );
  await MetaMessage.create({
    conversationId,
    platform,
    direction: "out",
    source: "ai",
    text,
    errorBody: send.ok ? "" : `${send.status} ${send.body}`.slice(0, 1000),
  });
  if (send.ok) {
    await MetaConversation.findByIdAndUpdate(conversationId, {
      lastMessagePreview: text.slice(0, 200),
      lastMessageDirection: "out",
      lastMessageAt: new Date(),
    });
  } else {
    console.error("[meta/webhook] welcome menu send fail", send.status, send.body);
  }
}

function isWithinBusinessHours(startMin: number, endMin: number, tz: string): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
    const cur = h * 60 + m;
    if (startMin <= endMin) return cur >= startMin && cur < endMin;
    return cur >= startMin || cur < endMin;
  } catch {
    return true;
  }
}
