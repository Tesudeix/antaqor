// Flow Builder runtime — executes admin-authored MetaFlow documents on live
// Instagram / Messenger DMs.
//
// Flows are STATELESS at runtime: every card button carries the next card id
// (or an action) inside its postback payload, so advancing a conversation needs
// no per-conversation state. A flow is entered when an inbound message matches
// its keywords; subsequent button taps navigate card → card.
//
// Payload conventions emitted by this module (parsed back in the webhook):
//   flow:<flowId>:<cardId>     → send that card  ("" cardId = end the branch)
//   flowact:<flowId>:<action>  → run an action  (human | subscribe | end)
//   flowjump:<targetFlowId>    → enter another flow at its entry card

import MetaFlow, { IMetaFlow, IFlowCard } from "@/models/MetaFlow";
import MetaMessage from "@/models/MetaMessage";
import MetaFlowSession from "@/models/MetaFlowSession";
import MetaConversation from "@/models/MetaConversation";
import { sendFlowCard, sendFlowCarousel, FlowSendButton, MetaPlatform, SendDmOptions } from "@/lib/metaDm";

const norm = (s: string) => s.trim().toLowerCase();

// ── Per-(contact × flow) state ────────────────────────────────────────────
// A card is "terminal" when it offers no onward button to tap.
function isTerminalCard(card: IFlowCard | undefined): boolean {
  if (!card) return true;
  return !(card.buttons || []).some((b) => b.label?.trim());
}

// Enter (or re-enter) a flow: park the contact on `nodeId`, mark the row active,
// and point the conversation at it. Completes any OTHER active session for the
// same contact so "one active flow per contact" holds for the live counts.
async function openFlowSession(
  account: string,
  convId: string,
  flowId: string,
  nodeId: string,
  eventId = ""
): Promise<void> {
  await MetaFlowSession.updateMany(
    { conversationId: convId, flowId: { $ne: flowId }, status: "active" },
    { $set: { status: "completed" } }
  ).catch(() => {});
  await MetaFlowSession.findOneAndUpdate(
    { conversationId: convId, flowId },
    {
      $set: { account, nodeId, status: "active", lastAdvancedAt: new Date() },
      $setOnInsert: { enteredAt: new Date(), enteredViaEvent: eventId },
    },
    { upsert: true }
  ).catch(() => {});
  await MetaConversation.findByIdAndUpdate(convId, { activeFlow: { flowId, nodeId } }).catch(() => {});
}

// Move a live session forward to `nodeId`. Terminal cards complete the session
// and release the conversation lock so normal handling resumes.
async function advanceFlowSession(
  convId: string,
  flowId: string,
  nodeId: string,
  terminal: boolean
): Promise<void> {
  await MetaFlowSession.findOneAndUpdate(
    { conversationId: convId, flowId },
    { $set: { nodeId, status: terminal ? "completed" : "active", lastAdvancedAt: new Date() } }
  ).catch(() => {});
  await MetaConversation.findByIdAndUpdate(
    convId,
    { activeFlow: terminal ? null : { flowId, nodeId } }
  ).catch(() => {});
}

// Close out a flow (branch-end, action node, or vanished card) and unlock.
async function endFlowSession(
  convId: string,
  flowId: string,
  status: "completed" | "exited" = "completed"
): Promise<void> {
  await MetaFlowSession.findOneAndUpdate(
    { conversationId: convId, flowId },
    { $set: { status, lastAdvancedAt: new Date() } }
  ).catch(() => {});
  await MetaConversation.findByIdAndUpdate(convId, { activeFlow: null }).catch(() => {});
}

// Contact bailed out via an exit keyword while parked on a card.
export async function exitCurrentFlow(convId: string, flowId: string): Promise<void> {
  await endFlowSession(convId, flowId, "exited");
}

// Re-send the card a contact is currently parked on (used when they TYPE text
// mid-flow instead of tapping a button — "unknown input mid-flow"). Returns
// false when the flow/card no longer exists (flow edited): the session is
// marked exited and the caller resumes normal handling.
export async function resendCurrentCard(
  platform: MetaPlatform,
  account: string,
  recipientId: string,
  convId: string,
  af: { flowId: string; nodeId: string }
): Promise<boolean> {
  const flow = await MetaFlow.findById(af.flowId).lean<IMetaFlow>();
  const card = flow?.cards?.find((c) => c.id === af.nodeId);
  if (!flow || !card) {
    await endFlowSession(convId, af.flowId, "exited");
    return false;
  }
  await deliver(platform, account, recipientId, convId, flow, card);
  return true;
}

function keywordMatches(text: string, keywords: string[], mode: string): boolean {
  if (mode === "any") return true; // catch-all flow — matches every message
  const t = norm(text);
  const kws = (keywords || []).map(norm).filter(Boolean);
  if (kws.length === 0) return false;
  switch (mode) {
    case "exact": return kws.some((k) => t === k);
    case "starts_with": return kws.some((k) => t.startsWith(k));
    case "contains":
    default: return kws.some((k) => t.includes(k));
  }
}

export interface FlowMatch { flow: IMetaFlow; card: IFlowCard }

// The single enabled main flow for this platform + account, if one exists.
export async function findMainFlow(
  platform: MetaPlatform,
  account: string
): Promise<FlowMatch | null> {
  const f = await MetaFlow.findOne({
    isMain: true,
    enabled: true,
    platform: { $in: ["both", platform] },
    $or: [{ account: "all" }, { account }],
  }).lean<IMetaFlow>();
  if (!f) return null;
  const card = (f.cards || []).find((c) => c.id === f.entryCardId) || f.cards?.[0];
  if (!card) return null;
  return { flow: f, card };
}

// First enabled flow (for this platform + account) whose keywords match.
// Falls back to the main flow when no keyword-specific flow matches, so the
// main flow acts as a universal catch-all for every inbound message.
export async function findMatchingFlow(
  text: string,
  platform: MetaPlatform,
  account: string
): Promise<FlowMatch | null> {
  const flows = await MetaFlow.find({ enabled: true }).sort({ updatedAt: -1 }).lean<IMetaFlow[]>();
  for (const f of flows) {
    if (f.platform !== "both" && f.platform !== platform) continue;
    if (f.account && f.account !== "all" && f.account !== account) continue;
    if (!keywordMatches(text, f.triggerKeywords, f.matchMode)) continue;
    const card = (f.cards || []).find((c) => c.id === f.entryCardId) || f.cards?.[0];
    if (!card) continue;
    return { flow: f, card };
  }
  // No keyword match — fall back to main flow (fires for any message)
  return findMainFlow(platform, account);
}

function cardButtons(flow: IMetaFlow, card: IFlowCard): FlowSendButton[] {
  return (card.buttons || [])
    .filter((b) => b.label?.trim())
    .map((b): FlowSendButton => {
      if (b.kind === "url") return { type: "url", label: b.label, url: b.value };
      if (b.kind === "action") return { type: "postback", label: b.label, payload: `flowact:${flow._id}:${b.value}` };
      if (b.kind === "flow") return { type: "postback", label: b.label, payload: `flowjump:${b.value}` };
      // next-card (empty value = end of branch)
      return { type: "postback", label: b.label, payload: `flow:${flow._id}:${b.value}` };
    });
}

async function deliver(
  platform: MetaPlatform,
  account: string,
  recipientId: string,
  convId: string,
  flow: IMetaFlow,
  card: IFlowCard,
  sendOpts: SendDmOptions = {}
): Promise<void> {
  // Carousel: collect this card + consecutive carousel-flagged cards, send as
  // one horizontal-scroll gallery. Falls back to single card if group size = 1.
  if (card.carousel) {
    const startIdx = flow.cards.findIndex((c) => c.id === card.id);
    if (startIdx >= 0) {
      const group: IFlowCard[] = [];
      for (let i = startIdx; i < flow.cards.length && flow.cards[i]?.carousel; i++) {
        group.push(flow.cards[i]);
      }
      if (group.length > 1) {
        await sendFlowCarousel(
          platform,
          recipientId,
          group.map((c, idx) => ({
            text: c.text,
            imageUrl: c.imageUrl || (idx === 0 ? flow.imageUrl : undefined),
            subtitle: c.subtitle,
            buttons: cardButtons(flow, c),
          })),
          { account, ...sendOpts }
        );
        await MetaMessage.create({
          conversationId: convId,
          platform,
          direction: "out",
          source: "trigger",
          text: `[carousel] ${group.map((c) => c.text || c.subtitle || "card").join(" | ").slice(0, 200)}`,
        }).catch(() => {});
        return;
      }
    }
  }

  await sendFlowCard(
    platform,
    recipientId,
    { text: card.text, imageUrl: card.imageUrl, subtitle: card.subtitle, buttons: cardButtons(flow, card) },
    { account, ...sendOpts }
  );
  await MetaMessage.create({
    conversationId: convId,
    platform,
    direction: "out",
    source: "trigger",
    text: card.text || card.subtitle || "[flow card]",
  }).catch(() => {});
}

// Enter a flow at its entry card. Bumps the flow's hitCount.
// sendOpts lets callers (e.g. the 24h auto-send) attach a message tag so the
// entry card can be delivered outside Meta's 24-hour standard messaging window.
export async function startFlow(
  platform: MetaPlatform,
  account: string,
  recipientId: string,
  convId: string,
  match: FlowMatch,
  sendOpts: SendDmOptions = {}
): Promise<void> {
  await MetaFlow.updateOne({ _id: match.flow._id }, { $inc: { hitCount: 1 } }).catch(() => {});
  // The entry card inherits the flow's hero image (Card 1) when it has none of
  // its own, so the cover image leads the conversation — matching the builder's
  // live preview. Non-entry cards (navigated via postback) keep their own image.
  const entryCard: IFlowCard = match.card.imageUrl ? match.card : { ...match.card, imageUrl: match.flow.imageUrl };
  await deliver(platform, account, recipientId, convId, match.flow, entryCard, sendOpts);
  // Record where the contact now sits. A single-card flow with no buttons is
  // already terminal — complete it immediately rather than locking the contact.
  if (isTerminalCard(match.card)) {
    await endFlowSession(convId, String(match.flow._id), "completed");
  } else {
    await openFlowSession(account, convId, String(match.flow._id), match.card.id);
  }
}

export type FlowPostbackResult = "nav" | "human" | "subscribe" | "order" | "pay" | "end" | "none";

// Handle a button tap. "nav"/"end" are fully handled here; "human"/"subscribe"
// are returned for the webhook to run (it owns escalation + acknowledgement).
export async function handleFlowPostback(
  platform: MetaPlatform,
  account: string,
  recipientId: string,
  convId: string,
  payload: string
): Promise<FlowPostbackResult> {
  if (payload.startsWith("flowjump:")) {
    const targetFlowId = payload.split(":")[1];
    const targetFlow = await MetaFlow.findById(targetFlowId).lean<IMetaFlow>();
    if (!targetFlow?.enabled) return "end";
    const entryCard = (targetFlow.cards || []).find((c) => c.id === targetFlow.entryCardId) || targetFlow.cards?.[0];
    if (!entryCard) return "end";
    const card: IFlowCard = entryCard.imageUrl ? entryCard : { ...entryCard, imageUrl: targetFlow.imageUrl };
    await MetaFlow.updateOne({ _id: targetFlowId }, { $inc: { hitCount: 1 } }).catch(() => {});
    await deliver(platform, account, recipientId, convId, targetFlow, card);
    // Jumped into a different flow — re-park the contact there (entry node).
    if (isTerminalCard(entryCard)) await endFlowSession(convId, String(targetFlowId), "completed");
    else await openFlowSession(account, convId, String(targetFlowId), entryCard.id);
    return "nav";
  }
  if (payload.startsWith("flow:")) {
    const [, flowId, cardId] = payload.split(":");
    if (!cardId) {
      // explicit branch end — release the lock so normal handling resumes
      await endFlowSession(convId, String(flowId), "completed");
      return "end";
    }
    const flow = await MetaFlow.findById(flowId).lean<IMetaFlow>();
    const card = flow?.cards?.find((c) => c.id === cardId);
    if (flow && card) {
      await deliver(platform, account, recipientId, convId, flow, card);
      // Forward-advance the session; terminal cards complete + unlock.
      await advanceFlowSession(convId, String(flowId), cardId, isTerminalCard(card));
      return "nav";
    }
    await endFlowSession(convId, String(flowId), "exited"); // target card vanished
    return "end";
  }
  if (payload.startsWith("flowact:")) {
    const flowId = payload.split(":")[1];
    const action = payload.split(":")[2] || "end";
    // An action node is a flow exit point — unlock the conversation. (human /
    // order escalation is then owned by the webhook.)
    if (flowId) await endFlowSession(convId, String(flowId), "completed");
    if (action === "human") return "human";
    if (action === "subscribe") return "subscribe";
    if (action === "order") return "order";
    if (action === "pay") return "pay";
    return "end";
  }
  return "none";
}
