// ─── Comment-Order Bot ENGINE ───
// comment (түлхүүр үг) → public хариу + DM → захиалгын дараалсан асуулт →
// CommentOrder. Бүх шилжилт idempotent: dedupe (bot+post+user unique),
// session нэг харилцан ярианд нэг л байна, webhook давхар ирсэн ч давхардахгүй.

import type { Types } from "mongoose";
import CommentBot, { ICommentBot } from "@/models/CommentBot";
import { CommentOrder, CommentBotHit, OrderSession, IOrderSession } from "@/models/CommentOrder";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import MetaWelcome from "@/models/MetaWelcome";
import { sendDm, sendImageAttachment, type MetaPlatform, type QuickReply } from "@/lib/metaDm";
import { sendPrivateReplyToComment, replyToComment } from "@/lib/metaComment";

// ── Түлхүүр үг тааруулах: case-insensitive, whitespace-trim, кирилл-ээр зүгээр ──
function keywordHit(text: string, keywords: string[], wholeWord: boolean): boolean {
  const hay = text.toLowerCase().trim();
  return keywords.some((raw) => {
    const kw = String(raw || "").toLowerCase().trim();
    if (!kw) return false;
    if (!wholeWord) return hay.includes(kw);
    // Бүтэн үгээр: үг таслагч нь зай/цэг таслал (кирилл үсэг үгийн хэсэгт тооцно).
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, "iu").test(hay);
  });
}

function render(tpl: string, vars: { username?: string }): string {
  return tpl.replace(/\{\{\s*username\s*\}\}/gi, vars.username ? `@${vars.username}` : "").trim();
}

async function persistOut(conversationId: string, platform: MetaPlatform, text: string) {
  await MetaMessage.create({
    conversationId,
    platform,
    direction: "out",
    source: "trigger",
    text: text.slice(0, 500),
  }).catch(() => {});
}

interface ConvLite {
  _id: Types.ObjectId | string;
  partnerName?: string;
}

export interface CommentEvt {
  postId: string;
  commentId: string;
  fromId: string;
  fromUsername: string;
  text: string;
}

// ── Захиалгын алхмын мессежүүд ──
async function askProduct(bot: ICommentBot, platform: MetaPlatform, partnerId: string, convId: string) {
  const products = bot.products.slice(0, 6);
  const qrs: QuickReply[] = products.map((p, i) => ({
    label: (p.price > 0 ? `${p.name}` : p.name).slice(0, 20),
    payload: `ord:p:${i}`,
  }));
  const lines = products
    .map((p, i) => `${i + 1}. ${p.name}${p.price > 0 ? ` — ${p.price.toLocaleString("en-US")}₮` : ""}`)
    .join("\n");
  const text = `Аль бүтээгдэхүүнийг захиалах вэ?\n${lines}`;
  await sendDm(platform, partnerId, text, { account: bot.account, quickReplies: qrs });
  await persistOut(convId, platform, text);
}

async function askQty(bot: ICommentBot, platform: MetaPlatform, partnerId: string, convId: string) {
  const text = "Хэдэн ширхэг авах вэ?";
  await sendDm(platform, partnerId, text, {
    account: bot.account,
    quickReplies: [
      { label: "1", payload: "ord:q:1" },
      { label: "2", payload: "ord:q:2" },
      { label: "3", payload: "ord:q:3" },
      { label: "Өөр тоо", payload: "ord:q:other" },
    ],
  });
  await persistOut(convId, platform, text);
}

async function askPhone(bot: ICommentBot, platform: MetaPlatform, partnerId: string, convId: string, retry = false) {
  const text = retry
    ? "Утасны дугаар буруу байх шиг байна. 8 оронтой, 6/7/8/9-өөр эхэлсэн дугаар бичнэ үү. Жишээ: 88112233"
    : "Утасны дугаараа бичнэ үү (жишээ: 88112233):";
  await sendDm(platform, partnerId, text, { account: bot.account });
  await persistOut(convId, platform, text);
}

async function askAddress(bot: ICommentBot, platform: MetaPlatform, partnerId: string, convId: string) {
  const text = "Хүргэлтийн хаягаа бичнэ үү (дүүрэг, хороо, байр):";
  await sendDm(platform, partnerId, text, { account: bot.account });
  await persistOut(convId, platform, text);
}

async function sendSummary(s: IOrderSession, bot: ICommentBot) {
  const text =
    `Захиалгын мэдээлэл:\n` +
    `Бүтээгдэхүүн: ${s.product}\n` +
    `Тоо: ${s.qty}\n` +
    `Утас: ${s.phone}${s.phoneUnverified ? " (шалгагдаагүй)" : ""}\n` +
    `Хаяг: ${s.address}\n\nЗөв үү?`;
  await sendDm(s.platform, s.partnerId, text, {
    account: bot.account,
    quickReplies: [
      { label: "Баталгаажуулах ✓", payload: "ord:ok" },
      { label: "Засах", payload: "ord:edit" },
    ],
  });
  await persistOut(String(s.conversationId), s.platform, text);
}

async function finalizeOrder(s: IOrderSession, bot: ICommentBot) {
  await CommentOrder.create({
    botId: bot._id,
    account: bot.account,
    platform: s.platform,
    partnerId: s.partnerId,
    username: s.username,
    conversationId: s.conversationId,
    product: s.product,
    qty: s.qty,
    phone: s.phone,
    phoneUnverified: s.phoneUnverified,
    address: s.address,
    status: "new",
  });
  await CommentBot.updateOne({ _id: bot._id }, { $inc: { "stats.orders": 1 } }).catch(() => {});
  await MetaConversation.findByIdAndUpdate(s.conversationId, { intentLabel: "захиалга" }).catch(() => {});
  await OrderSession.deleteOne({ _id: s._id }).catch(() => {});

  // Төлбөрийн мэдээлэл — Тохиргоо (MetaWelcome.payText) эсвэл default.
  const w = await MetaWelcome.findOne({ account: bot.account }).select("payText").lean<{ payText?: string }>();
  const payText = (w?.payText || "").trim();
  const text =
    `Баярлалаа! Захиалга №-тэй бүртгэгдлээ ✓\n` +
    (payText ? `Төлбөрийн мэдээлэл:\n${payText}` : "Манай ажилтан төлбөрийн мэдээллийг удахгүй илгээнэ.");
  await sendDm(s.platform, s.partnerId, text, { account: bot.account });
  await persistOut(String(s.conversationId), s.platform, text);
}

// ─── COMMENT EVENT: ботууд тааруулж, нэг л удаа хариулна ───
export async function processCommentForBots(
  platform: MetaPlatform,
  account: string,
  evt: CommentEvt,
  getConv: () => Promise<ConvLite>
): Promise<boolean> {
  const bots = await CommentBot.find({ enabled: true, account });
  if (bots.length === 0) return false;

  for (const bot of bots) {
    if (bot.platform !== "both" && bot.platform !== platform) continue;
    if (bot.postId && bot.postId !== evt.postId) continue;
    if (bot.keywords.length === 0 || !keywordHit(evt.text, bot.keywords, bot.matchWholeWord)) continue;

    // Dedupe — (bot, post, user) нэг л удаа. Unique index давхар webhook-оос хамгаална.
    try {
      await CommentBotHit.create({ botId: bot._id, postId: evt.postId || "", igUserId: evt.fromId });
    } catch {
      return true; // өмнө нь хариулсан — дахин хариулахгүй, гэхдээ "манайх" гэж тооцно
    }

    await CommentBot.updateOne({ _id: bot._id }, { $inc: { "stats.triggered": 1 } }).catch(() => {});

    try {
      // 1) Нийтэд харагдах comment хариу (сонголтоор)
      if (bot.commentReply) {
        const cr = await replyToComment(platform, evt.commentId, render(bot.commentReply, { username: evt.fromUsername }), { account });
        if (!cr.ok) console.warn("[order-bot] comment reply fail", cr.status);
      }

      // 2) DM #1 — private reply (24h цонхыг нээнэ)
      const dm1 = render(bot.dmText, { username: evt.fromUsername });
      const pr = await sendPrivateReplyToComment(platform, evt.commentId, dm1, { account });
      if (!pr.ok) throw new Error(`private reply ${pr.status}: ${String(pr.body).slice(0, 120)}`);

      const conv = await getConv();
      await persistOut(String(conv._id), platform, dm1);
      if (bot.dmImage) {
        await sendImageAttachment(platform, evt.fromId, bot.dmImage, { account }).catch(() => {});
      }
      if (bot.dmButtons.length > 0 && !bot.collectOrders) {
        const btnText = "Дэлгэрэнгүй:";
        await sendDm(platform, evt.fromId, btnText, {
          account,
          quickReplies: bot.dmButtons.slice(0, 3).map((b, i) => ({ label: b.label.slice(0, 20), payload: `cmd:${b.url}` })),
        }).catch(() => {});
      }
      await CommentBot.updateOne({ _id: bot._id }, { $inc: { "stats.dmSent": 1 }, $set: { lastError: "" } }).catch(() => {});

      // 3) Захиалга авах flow эхлүүлэх
      if (bot.collectOrders && bot.products.length > 0) {
        await OrderSession.findOneAndUpdate(
          { conversationId: conv._id },
          {
            $set: {
              botId: bot._id,
              account,
              platform,
              partnerId: evt.fromId,
              username: evt.fromUsername || "",
              step: bot.products.length === 1 ? "qty" : "product",
              product: bot.products.length === 1 ? bot.products[0].name : "",
              qty: 1,
              phone: "",
              phoneUnverified: false,
              phoneAttempts: 0,
              address: "",
            },
          },
          { upsert: true }
        );
        if (bot.products.length === 1) await askQty(bot, platform, evt.fromId, String(conv._id));
        else await askProduct(bot, platform, evt.fromId, String(conv._id));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : "send error";
      await CommentBot.updateOne({ _id: bot._id }, { $set: { lastError: msg } }).catch(() => {});
      console.error("[order-bot]", bot.name, msg);
    }
    return true; // нэг comment-д нэг л бот ажиллана
  }
  return false;
}

// ─── DM: идэвхтэй захиалгын session-ий алхмыг боловсруулна ───
export async function handleOrderDm(
  platform: MetaPlatform,
  conversationId: string,
  text: string
): Promise<boolean> {
  const s = await OrderSession.findOne({ conversationId });
  if (!s) return false;
  const bot = await CommentBot.findById(s.botId);
  if (!bot || !bot.enabled) {
    await OrderSession.deleteOne({ _id: s._id }).catch(() => {});
    return false;
  }
  const trimmed = text.trim();

  // Гарах үг — хэрэглэгч болих боломжтой байх ёстой.
  if (/^(болих|cancel|stop|зогс)$/i.test(trimmed)) {
    await OrderSession.deleteOne({ _id: s._id });
    const t = "Захиалга цуцлагдлаа. Дахин захиалах бол пост дээр comment бичээрэй 🙌";
    await sendDm(platform, s.partnerId, t, { account: bot.account });
    await persistOut(conversationId, platform, t);
    return true;
  }

  if (s.step === "product") {
    // Дугаараар эсвэл нэрээр сонгох
    const idx = parseInt(trimmed, 10) - 1;
    const byIdx = Number.isInteger(idx) ? bot.products[idx] : undefined;
    const byName = bot.products.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    const pick = byIdx || byName;
    if (!pick) {
      await askProduct(bot, platform, s.partnerId, conversationId);
      return true;
    }
    s.product = pick.name;
    s.step = "qty";
    await s.save();
    await askQty(bot, platform, s.partnerId, conversationId);
    return true;
  }

  if (s.step === "qty") {
    const n = parseInt(trimmed.replace(/[^\d]/g, ""), 10);
    if (!Number.isInteger(n) || n < 1 || n > 999) {
      const t = "Тоогоо зөвхөн цифрээр бичнэ үү (жишээ: 2):";
      await sendDm(platform, s.partnerId, t, { account: bot.account });
      await persistOut(conversationId, platform, t);
      return true;
    }
    s.qty = n;
    s.step = "phone";
    await s.save();
    await askPhone(bot, platform, s.partnerId, conversationId);
    return true;
  }

  if (s.step === "phone") {
    const digits = trimmed.replace(/[^\d]/g, "");
    const valid = /^[6-9]\d{7}$/.test(digits);
    if (!valid && s.phoneAttempts < 1) {
      s.phoneAttempts += 1;
      await s.save();
      await askPhone(bot, platform, s.partnerId, conversationId, true);
      return true;
    }
    s.phone = valid ? digits : trimmed.slice(0, 30);
    s.phoneUnverified = !valid;
    s.step = "address";
    await s.save();
    await askAddress(bot, platform, s.partnerId, conversationId);
    return true;
  }

  if (s.step === "address") {
    if (trimmed.length < 5) {
      const t = "Хаягаа арай дэлгэрэнгүй бичээрэй (дүүрэг, хороо, байр):";
      await sendDm(platform, s.partnerId, t, { account: bot.account });
      await persistOut(conversationId, platform, t);
      return true;
    }
    s.address = trimmed.slice(0, 500);
    s.step = "confirm";
    await s.save();
    await sendSummary(s, bot);
    return true;
  }

  if (s.step === "confirm") {
    if (/^(тийм|za|за|ok|зөв|yes)$/i.test(trimmed)) {
      await finalizeOrder(s, bot);
      return true;
    }
    await sendSummary(s, bot);
    return true;
  }

  return false;
}

// ─── Товчны postback: ord:p:<i> · ord:q:<n|other> · ord:ok · ord:edit ───
export async function handleOrderPostback(
  platform: MetaPlatform,
  conversationId: string,
  payload: string
): Promise<boolean> {
  if (!payload.startsWith("ord:")) return false;
  const s = await OrderSession.findOne({ conversationId });
  if (!s) return true; // хуучирсан товч — чимээгүй залгина
  const bot = await CommentBot.findById(s.botId);
  if (!bot) {
    await OrderSession.deleteOne({ _id: s._id }).catch(() => {});
    return true;
  }

  const parts = payload.split(":");
  if (parts[1] === "p") {
    const p = bot.products[Number(parts[2])];
    if (p) {
      s.product = p.name;
      s.step = "qty";
      await s.save();
      await askQty(bot, platform, s.partnerId, conversationId);
    } else {
      await askProduct(bot, platform, s.partnerId, conversationId);
    }
    return true;
  }
  if (parts[1] === "q") {
    if (parts[2] === "other") {
      const t = "Хэдэн ширхэг авахаа цифрээр бичнэ үү:";
      await sendDm(platform, s.partnerId, t, { account: bot.account });
      await persistOut(conversationId, platform, t);
      return true;
    }
    s.qty = Math.max(1, Number(parts[2]) || 1);
    s.step = "phone";
    await s.save();
    await askPhone(bot, platform, s.partnerId, conversationId);
    return true;
  }
  if (parts[1] === "ok" && s.step === "confirm") {
    await finalizeOrder(s, bot);
    return true;
  }
  if (parts[1] === "edit") {
    s.step = bot.products.length === 1 ? "qty" : "product";
    s.phoneAttempts = 0;
    await s.save();
    if (bot.products.length === 1) await askQty(bot, platform, s.partnerId, conversationId);
    else await askProduct(bot, platform, s.partnerId, conversationId);
    return true;
  }
  return true;
}
