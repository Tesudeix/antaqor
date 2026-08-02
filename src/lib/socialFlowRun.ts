// ─── SocialFlow RUNTIME — визуал builder-ийн graph-ыг бодитоор ажиллуулна ───
//
// ManyChat загвар: inbound DM → trigger node keyword таарвал graph-аар алхана.
//   message   → DM илгээгээд цааш
//   buttons   → quick reply-тэй DM илгээгээд ТОВЧ ХҮЛЭЭНЭ (payload sf:flow:node:opt)
//   delay     → session-д resumeAt бичээд зогсоно (cron сэргээнэ)
//   condition → сүүлийн текст дээр contains/equals шалгаад yes/no мөчрөөр
//   action    → tag / subscribe / unsubscribe / notify
//
// Нэг удаагийн гүйлт дээд тал нь 12 алхам — сүлжсэн graph-ээс хамгаална.

import type { Types } from "mongoose";
import SocialFlow, { IFlowNode, IFlowEdge } from "@/models/SocialFlow";
import SocialFlowSession from "@/models/SocialFlowSession";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import { sendDm, sendImageAttachment, type MetaPlatform } from "@/lib/metaDm";

const MAX_STEPS = 12;

export interface FlowLean {
  _id: Types.ObjectId | string;
  name: string;
  platform: string;
  account?: string;
  enabled: boolean;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
}

export interface FlowCtx {
  platform: MetaPlatform;
  account: string;
  partnerId: string;
  conversationId: string;
  lastText: string;
}

// Flow-ийн platform талбар inbound platform-тай таарах уу.
// "facebook" ≈ messenger; "threads"-д DM runtime байхгүй (Threads API DM дэмждэггүй).
function platformMatches(flowPlatform: string, inbound: MetaPlatform): boolean {
  if (flowPlatform === "instagram") return inbound === "instagram";
  if (flowPlatform === "messenger" || flowPlatform === "facebook") return inbound === "messenger";
  return false;
}

function matchKeywords(text: string, keywords: string[], mode: string): boolean {
  if (mode === "any") return true;
  const hay = text.toLowerCase();
  return keywords.some((kwRaw) => {
    const kw = String(kwRaw || "").toLowerCase().trim();
    if (!kw) return false;
    if (mode === "exact") return hay.trim() === kw;
    if (mode === "starts_with") return hay.trimStart().startsWith(kw);
    return hay.includes(kw);
  });
}

function nextNode(flow: FlowLean, nodeId: string, handle = "out"): IFlowNode | null {
  const edge = (flow.edges || []).find(
    (e) => e.source === nodeId && (e.sourceHandle === handle || (handle === "out" && !e.sourceHandle))
  );
  if (!edge) return null;
  return (flow.nodes || []).find((n) => n.id === edge.target) || null;
}

async function persistOut(conversationId: string, platform: MetaPlatform, text: string): Promise<void> {
  await MetaMessage.create({
    conversationId,
    platform,
    direction: "out",
    source: "trigger",
    text: text.slice(0, 500),
  }).catch(() => {});
}

export interface SocialFlowMatch {
  flow: FlowLean;
  triggerNode: IFlowNode;
}

// Inbound DM-ийн текстэд таарах идэвхтэй флоу хайна (account + platform шүүлттэй).
export async function findMatchingSocialFlow(
  text: string,
  platform: MetaPlatform,
  account: string
): Promise<SocialFlowMatch | null> {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;
  const flows = await SocialFlow.find({ enabled: true })
    .select("name platform account enabled nodes edges")
    .lean<FlowLean[]>();
  for (const f of flows) {
    if (!platformMatches(f.platform, platform)) continue;
    if ((f.account || "antaqor") !== account) continue;
    const trig = (f.nodes || []).find((n) => n.type === "trigger");
    if (!trig) continue;
    const kws = (trig.data?.keywords as string[]) || [];
    const mode = String(trig.data?.matchMode || "contains");
    if (mode !== "any" && kws.length === 0) continue;
    if (matchKeywords(trimmed, kws, mode)) return { flow: f, triggerNode: trig };
  }
  return null;
}

// Graph-аар алхах гол хөдөлгүүр. `node`-оос эхэлж ажиллана.
export async function runSocialFlowFrom(flow: FlowLean, startNode: IFlowNode, ctx: FlowCtx): Promise<void> {
  let cur: IFlowNode | null = startNode;
  let steps = 0;

  while (cur && steps++ < MAX_STEPS) {
    if (cur.type === "trigger") {
      cur = nextNode(flow, cur.id);
      continue;
    }

    if (cur.type === "message") {
      const text = String(cur.data?.text || "").trim();
      const imageUrl = String(cur.data?.imageUrl || "").trim();
      if (imageUrl) {
        await sendImageAttachment(ctx.platform, ctx.partnerId, imageUrl, { account: ctx.account }).catch(() => {});
      }
      if (text) {
        await sendDm(ctx.platform, ctx.partnerId, text, { account: ctx.account });
        await persistOut(ctx.conversationId, ctx.platform, text);
      }
      cur = nextNode(flow, cur.id);
      continue;
    }

    if (cur.type === "buttons") {
      const text = String(cur.data?.text || "Сонголтоо хийнэ үү:").trim();
      const options = ((cur.data?.options as { id: string; label: string }[]) || []).filter((o) => o?.label);
      const nodeId = cur.id;
      await sendDm(ctx.platform, ctx.partnerId, text, {
        account: ctx.account,
        quickReplies: options.slice(0, 13).map((o) => ({
          label: String(o.label).slice(0, 20),
          payload: `sf:${flow._id}:${nodeId}:${o.id}`,
        })),
      });
      await persistOut(ctx.conversationId, ctx.platform, `${text} [${options.map((o) => o.label).join(" · ")}]`);
      await SocialFlowSession.findOneAndUpdate(
        { conversationId: ctx.conversationId, flowId: flow._id },
        {
          $set: {
            platform: ctx.platform,
            account: ctx.account,
            partnerId: ctx.partnerId,
            nodeId,
            status: "waiting_button",
            resumeAt: null,
          },
        },
        { upsert: true }
      );
      return; // товч дарахыг хүлээнэ
    }

    if (cur.type === "delay") {
      const minutes = Math.min(72 * 60, Math.max(1, Number(cur.data?.minutes) || 1));
      const nxt = nextNode(flow, cur.id);
      if (!nxt) return;
      await SocialFlowSession.findOneAndUpdate(
        { conversationId: ctx.conversationId, flowId: flow._id },
        {
          $set: {
            platform: ctx.platform,
            account: ctx.account,
            partnerId: ctx.partnerId,
            nodeId: nxt.id,
            status: "waiting_delay",
            resumeAt: new Date(Date.now() + minutes * 60000),
          },
        },
        { upsert: true }
      );
      return; // cron сэргээнэ
    }

    if (cur.type === "condition") {
      const value = String(cur.data?.value || "").toLowerCase().trim();
      const op = String(cur.data?.op || "contains");
      const hay = (ctx.lastText || "").toLowerCase();
      const yes = value ? (op === "equals" ? hay.trim() === value : hay.includes(value)) : false;
      cur = nextNode(flow, cur.id, yes ? "yes" : "no");
      continue;
    }

    if (cur.type === "action") {
      const kind = String(cur.data?.kind || "");
      const value = String(cur.data?.value || "").slice(0, 60);
      if (kind === "tag" && value) {
        await MetaConversation.findByIdAndUpdate(ctx.conversationId, { intentLabel: value }).catch(() => {});
      } else if (kind === "unsubscribe") {
        await MetaConversation.findByIdAndUpdate(ctx.conversationId, { broadcastOptOut: true }).catch(() => {});
      } else if (kind === "subscribe") {
        await MetaConversation.findByIdAndUpdate(ctx.conversationId, { broadcastOptOut: false }).catch(() => {});
      } else if (kind === "notify") {
        console.log(`[social-flow] NOTIFY · flow=${flow.name} · conv=${ctx.conversationId} · ${value}`);
      }
      cur = nextNode(flow, cur.id);
      continue;
    }

    break; // үл мэдэх node төрөл
  }
}

// Trigger таарсан флоуг эхлүүлнэ (runs тоолуур +1).
export async function startSocialFlow(match: SocialFlowMatch, ctx: FlowCtx): Promise<void> {
  await SocialFlow.updateOne({ _id: match.flow._id }, { $inc: { runs: 1 } }).catch(() => {});
  await runSocialFlowFrom(match.flow, match.triggerNode, ctx);
}

// Товчны postback: sf:<flowId>:<nodeId>:<optionId> → тухайн мөчрөөр үргэлжилнэ.
export async function handleSocialFlowPostback(
  platform: MetaPlatform,
  account: string,
  senderId: string,
  conversationId: string,
  payload: string,
  tappedLabel?: string
): Promise<boolean> {
  const parts = payload.split(":");
  if (parts.length < 4 || parts[0] !== "sf") return false;
  const [, flowId, nodeId, optionId] = parts;

  const flow = await SocialFlow.findById(flowId)
    .select("name platform account enabled nodes edges")
    .lean<FlowLean | null>();
  if (!flow || !flow.enabled) return false;

  await SocialFlowSession.updateOne(
    { conversationId, flowId: flow._id },
    { $set: { status: "done", resumeAt: null } }
  ).catch(() => {});

  const nxt = nextNode(flow, nodeId, optionId);
  if (!nxt) return true; // мөчир төгссөн — товч дарсныг хүлээн зөвшөөрсөн хэвээр
  await runSocialFlowFrom(flow, nxt, {
    platform,
    account,
    partnerId: senderId,
    conversationId,
    lastText: tappedLabel || "",
  });
  return true;
}

// Delay-ийн хугацаа нь болсон session-уудыг сэргээнэ (cron 2 мин тутам).
export async function resumeDueSocialFlows(): Promise<number> {
  const due = await SocialFlowSession.find({ status: "waiting_delay", resumeAt: { $lte: new Date() } })
    .limit(20)
    .lean();
  let resumed = 0;
  for (const s of due) {
    // Эхлээд done болгоно — давхар гүйлтээс хамгаална.
    const claimed = await SocialFlowSession.findOneAndUpdate(
      { _id: s._id, status: "waiting_delay" },
      { $set: { status: "done" } }
    );
    if (!claimed) continue;
    const flow = await SocialFlow.findById(s.flowId)
      .select("name platform account enabled nodes edges")
      .lean<FlowLean | null>();
    if (!flow || !flow.enabled) continue;
    const node = (flow.nodes || []).find((n) => n.id === s.nodeId);
    if (!node) continue;
    await runSocialFlowFrom(flow, node, {
      platform: s.platform as MetaPlatform,
      account: s.account || "antaqor",
      partnerId: s.partnerId,
      conversationId: String(s.conversationId),
      lastText: "",
    });
    resumed++;
  }
  return resumed;
}
