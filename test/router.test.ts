// ───────────────────────────────────────────────────────────────────────────
// Integration tests for the REAL inbound webhook router.
//
// Strategy: drive the actual exported POST handler (src/app/api/meta/webhook)
// with HMAC-signed payloads, against a throwaway Mongo DB on the local mongod.
// Only the network / AI / DM-send boundaries are mocked; ALL routing, state,
// dedup, welcome-once, mid-flow lock and KB-answer logic is the real code.
//
// Each mocked metaDm send is recorded into `h.sends`; every test asserts the
// exact set of sends produced. Fail loudly on extra/missing sends.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";

// Env must exist before the route module evaluates its top-level consts.
process.env.META_APP_SECRET = "testsecret";
process.env.META_VERIFY_TOKEN = "vtok";
process.env.META_SELF_IDS = "";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/antaqor_test";

// Shared, hoisted recorder + canned values referenced inside vi.mock factories.
const h = vi.hoisted(() => ({
  sends: [] as Array<{ fn: string; args: unknown[] }>,
  GREETING: "GREETING_WELCOME_TEXT",
  KB_ANSWER: "KB_ANSWER_PRICE_50000",
}));

// ── Boundary mocks (network / AI / sends only) ──
vi.mock("@/lib/mongodb", () => ({ default: vi.fn(async () => {}) }));
vi.mock("@/lib/metaAccounts", () => ({
  accountForPageId: () => "testshop",
  ensurePageRegistry: vi.fn(async () => {}),
}));
vi.mock("@/lib/metaDm", () => {
  const rec = (fn: string) => (...args: unknown[]) => { h.sends.push({ fn, args }); return Promise.resolve({ ok: true }); };
  return {
    sendDm: rec("sendDm"),
    sendButtonTemplate: rec("sendButtonTemplate"),
    sendGenericTemplate: rec("sendGenericTemplate"),
    sendImageAttachment: rec("sendImageAttachment"),
    sendFlowCard: rec("sendFlowCard"),
    sendFlowCarousel: rec("sendFlowCarousel"),
  };
});
vi.mock("@/lib/metaAI", () => ({
  generateReply: async (userText: string, _s: unknown, ctx?: string) => {
    if (ctx && ctx.includes("МЭДЭЭЛЛИЙН САН")) {
      if (/unknownq/i.test(userText)) return { ok: true, text: "<NO_ANSWER>" };
      return { ok: true, text: h.KB_ANSWER };
    }
    return { ok: true, text: "GENERIC_AI" };
  },
}));
vi.mock("@/lib/antaqorAgent", () => ({ antaqorAgentReply: async () => "AGENT" }));
vi.mock("@/lib/metaIntent", () => ({ scoreIntent: async () => ({ score: 3, label: "unknown" }) }));
vi.mock("@/lib/metaProfile", () => ({ fetchPartnerProfile: async () => null }));
vi.mock("@/lib/metaComment", () => ({ sendPrivateReplyToComment: async () => {}, replyToComment: async () => {} }));
vi.mock("@/lib/metaMemory", () => ({ getMemo: async () => null, memoToContext: () => "", updateMemoFromTurn: async () => {} }));
vi.mock("@/lib/metaNurture", () => ({ enrollInNurture: async () => {}, stopEnrollmentsForConversation: async () => {} }));
vi.mock("@/lib/metaFunnel", async (orig) => ({ ...(await orig<Record<string, unknown>>()), alertHotLead: vi.fn(async () => {}) }));

// Real models (test DB).
import MetaWelcome from "@/models/MetaWelcome";
import MetaFlow from "@/models/MetaFlow";
import MetaSettings from "@/models/MetaSettings";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import MetaFlowSession from "@/models/MetaFlowSession";

type RouteMod = { POST: (req: unknown) => Promise<unknown> };
let route: RouteMod;

const settle = () => new Promise((r) => setTimeout(r, 450));
let midSeq = 0;

async function inbound(opts: { text?: string; mid?: string; sender?: string; qr?: string; postback?: string; title?: string }) {
  const sender = opts.sender || "u1";
  const mid = opts.mid || `m${++midSeq}`;
  const message = opts.postback
    ? undefined
    : { mid, text: opts.text, ...(opts.qr ? { quick_reply: { payload: opts.qr } } : {}) };
  const ev: Record<string, unknown> = { sender: { id: sender }, recipient: { id: "PAGE1" }, timestamp: Date.now() };
  if (message) ev.message = message;
  if (opts.postback) ev.postback = { payload: opts.postback, title: opts.title };
  const body = JSON.stringify({ object: "page", entry: [{ id: "PAGE1", messaging: [ev] }] });
  const sig = "sha256=" + crypto.createHmac("sha256", "testsecret").update(body).digest("hex");
  const req = new Request("http://x/api/meta/webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": sig, "content-type": "application/json" },
    body,
  });
  await route.POST(req);
  await settle();
}

// Greet a fresh contact (consumes welcome-once) then clear the recorder, so the
// NEXT inbound's sends are isolated. Mirrors a real returning contact.
async function prime(sender: string) {
  await inbound({ sender, text: "сайн уу" });
  h.sends.length = 0;
}

const allText = (c: { args: unknown[] }) =>
  c.args.map((a) => (typeof a === "string" ? a : a && typeof a === "object" && typeof (a as { text?: unknown }).text === "string" ? (a as { text: string }).text : "")).join(" | ");
const sendsText = () => h.sends.map(allText);
const has = (needle: string) => sendsText().some((t) => t.includes(needle));

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
  route = (await import("@/app/api/meta/webhook/route")) as unknown as RouteMod;
});
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  for (const M of [MetaWelcome, MetaFlow, MetaSettings, MetaConversation, MetaMessage, MetaFlowSession] as mongoose.Model<unknown>[]) {
    await M.deleteMany({});
  }
  await (mongoose.connection.collection("users").deleteMany({}).catch(() => {}));
  h.sends.length = 0;
  await MetaSettings.create({ singleton: "main", aiReplyEnabled: true, automationEnabled: true });
  await MetaWelcome.create({
    account: "testshop", enabled: true, welcomeMode: "menu", greeting: h.GREETING,
    defaultAction: "menu", businessFaq: "ҮНЭ: Хулийн массаж 50000 төгрөг. Хугацаа 60 минут.", buttons: [],
  });
  await MetaFlow.create({
    name: "Start", enabled: true, platform: "both", account: "all",
    triggerKeywords: ["start"], matchMode: "contains", entryCardId: "c1",
    cards: [
      { id: "c1", text: "CARD_ONE", buttons: [{ label: "Цааш", kind: "next", value: "c2" }] },
      { id: "c2", text: "CARD_TWO", buttons: [] },
    ],
  });
});

describe("inbound router", () => {
  it("a. first DM → welcome fires exactly once", async () => {
    await inbound({ sender: "ua", text: "сайн уу" });
    expect(h.sends.length).toBe(1);
    expect(has(h.GREETING)).toBe(true);
    const conv = await MetaConversation.findOne({ partnerId: "ua" }).lean();
    expect(conv?.welcomeMenuSent).toBe(true);
  });

  it("b. second different DM → welcome does NOT re-fire", async () => {
    await prime("ub");
    await inbound({ sender: "ub", text: "Үнэ хэд вэ?" });
    expect(has(h.GREETING)).toBe(false); // welcome greeting must not repeat
  });

  it("c. same event_id twice → exactly one send (idempotency)", async () => {
    await inbound({ sender: "uc", text: "сайн уу", mid: "DUP1" });
    await inbound({ sender: "uc", text: "сайн уу", mid: "DUP1" });
    expect(h.sends.length).toBe(1);
  });

  it("d. message while mid-flow → re-prompts current card, no trigger/menu", async () => {
    await prime("ud");
    await inbound({ sender: "ud", text: "start" });   // enter flow → card 1
    h.sends.length = 0;
    await inbound({ sender: "ud", text: "юу ч билээ" }); // random text mid-flow
    expect(h.sends.length).toBe(1);
    expect(has("CARD_ONE")).toBe(true);     // re-prompted current card
    expect(has(h.GREETING)).toBe(false);    // not the menu/greeting
  });

  it("e. unrecognized question WITH KB hit → KB answer, not the menu", async () => {
    await prime("ue");
    await inbound({ sender: "ue", text: "Үнэ хэд вэ?" });
    expect(has(h.KB_ANSWER)).toBe(true);
    expect(has(h.GREETING)).toBe(false);
  });

  it("f. unrecognized question, NO KB hit → menu fallback, NOT the greeting", async () => {
    await prime("uf");
    await inbound({ sender: "uf", text: "unknownq zzz" }); // KB returns <NO_ANSWER>
    expect(h.sends.length).toBe(1);
    expect(has(h.GREETING)).toBe(false); // spec: fallback must differ from greeting
  });

  it("g. two rapid first messages → no double-greet", async () => {
    await Promise.all([
      inbound({ sender: "ug", text: "сайн уу", mid: "g1" }),
      inbound({ sender: "ug", text: "Үнэ хэд вэ?", mid: "g2" }),
    ]);
    const greets = sendsText().filter((t) => t.includes(h.GREETING)).length;
    expect(greets).toBe(1); // welcome greeting at most once
  });

  it("h. keyword match → flow starts, session opens at entry node", async () => {
    await prime("uh");
    await inbound({ sender: "uh", text: "start please" });
    expect(has("CARD_ONE")).toBe(true);
    const conv = await MetaConversation.findOne({ partnerId: "uh" }).lean();
    const sess = await MetaFlowSession.findOne({ conversationId: conv?._id, status: "active" }).lean();
    expect(sess?.nodeId).toBe("c1");
  });
});
