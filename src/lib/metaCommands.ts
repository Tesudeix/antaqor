// Intent-based command handlers for incoming DMs.
// Returns a string to reply with, or null if no command matched (fall through to AI).

import crypto from "crypto";
import mongoose from "mongoose";
import User, { IUser } from "@/models/User";
import MetaConversation from "@/models/MetaConversation";
import type { MetaPlatform } from "@/models/MetaConversation";

// re-export for clarity (not used here directly)
export type { MetaPlatform };

// Normalized lowercase trimmed text
function norm(s: string): string {
  return s.trim().toLowerCase();
}

export type CommandResult = { text: string; markRead?: boolean } | null;

// ─── Auto-link or create a ghost user for an incoming DM ───
// Returns the User document associated with this Meta identity.
// If none exists, creates a "ghost" user with placeholder email/password —
// the user can later "claim" it by linking from /account/link-instagram.
export async function getOrCreateUserForPartner(
  platform: MetaPlatform,
  partnerId: string,
  fallbackName?: string
): Promise<IUser> {
  const field = platform === "instagram" ? "metaInstagramId" : "metaMessengerPsid";
  const existing = await User.findOne({ [field]: partnerId });
  if (existing) return existing;

  const placeholderEmail = `${platform}_${partnerId}@antaqor.dm`;
  const placeholderPassword = crypto.randomBytes(24).toString("hex");
  const created = await User.create({
    name: fallbackName || `${platform === "instagram" ? "IG" : "FB"} Friend`,
    email: placeholderEmail,
    password: placeholderPassword,
    [field]: partnerId,
    role: "user",
    credits: 0,
  });
  return created;
}

// ─── Format helpers ───
function daysUntil(d?: Date): number {
  if (!d) return 0;
  const ms = new Date(d).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

function formatDate(d?: Date): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("mn-MN");
}

function statusBlock(user: IUser): string {
  const days = daysUntil(user.subscriptionExpiresAt);
  const subLine = days > 0
    ? `🎫 Гишүүнчлэл: ${days} хоног үлдсэн (дуусах ${formatDate(user.subscriptionExpiresAt)})`
    : `🎫 Гишүүнчлэл: идэвхгүй — antaqor.com/pricing`;
  return [
    `👤 ${user.name}`,
    subLine,
    `✦ Кредит: ${user.credits ?? 0}`,
    user.level ? `⚡ Level ${user.level} · ${user.xp ?? 0} XP` : null,
    user.streakDays ? `🔥 Streak: ${user.streakDays} өдөр` : null,
  ].filter(Boolean).join("\n");
}

// ─── Command matching ───
const STATUS_KW = ["статус", "status", "би", "хэн", "who am i", "info", "профайл", "profile"];
const SUB_KW = ["гишүүнчлэл", "subscription", "subscribe", "member", "хугацаа", "сэргээх"];
const CREDIT_KW = ["кредит", "credit", "credits", "үлдэгдэл", "balance"];
const HELP_KW = ["тусламж", "help", "commands", "командууд", "?"];
const STOP_KW = ["stop", "unsubscribe", "хариулахаа боль", "болих", "болио", "зогс", "болгио"];
const RESUME_KW = ["start ai", "resume", "үргэлжлүүл", "үргэлжлүүлэх", "эхлүүл", "тийм болно"];
const HUMAN_KW = ["human", "хүн", "operator", "support", "real person", "жинхэнэ хүн", "ажилтан"];
const IDENTITY_KW = [
  "чи ai юу", "чи ai уу", "are you ai", "are you a bot", "are you human",
  "you a bot", "чи робот", "чи bot уу", "чи бот уу", "what are you", "хэн вэ чи",
];

function matchesAny(text: string, list: string[]): boolean {
  const t = norm(text);
  return list.some((kw) => t === kw || t === `/${kw}` || t.startsWith(`${kw} `));
}

// Human-handoff intent — the user wants a real person. matchesAny only fires on
// exact / prefix keywords, so "talk to human" (keyword at the END) used to slip
// through to the AI. Here we also scan curated phrases anywhere in the text and
// allow the bare keyword as a suffix. Kept specific to avoid false positives.
const HUMAN_PHRASES = [
  "talk to human", "talk to a human", "talk to real", "talk to someone",
  "talk to a person", "talk to support", "talk to an agent", "talk to agent",
  "speak to human", "speak to a human", "speak to someone", "speak to a person",
  "speak to agent", "real person", "live agent", "human agent",
  "want a human", "need a human", "want to talk to someone", "connect me to",
  "customer service", "customer support",
  "хүнтэй яр", "хүнтэй ярь", "хүнтэй ярил", "хүнтэй холбо", "хүн рүү",
  "жинхэнэ хүн", "ажилтантай", "ажилтан тай", "оператор", "хүн дуудах",
];
export function wantsHuman(text: string): boolean {
  const t = norm(text);
  if (!t) return false;
  if (HUMAN_PHRASES.some((p) => t.includes(p))) return true;
  return HUMAN_KW.some(
    (kw) => t === kw || t === `/${kw}` || t.startsWith(`${kw} `) || t.endsWith(` ${kw}`)
  );
}

function extractLinkCode(text: string): string | null {
  // Accept formats: "link 123456", "холбох 123456", or bare 6-digit code
  const m = text.match(/(?:link|холбох)\s+(\d{6})/i);
  if (m) return m[1];
  const bare = text.trim().match(/^(\d{6})$/);
  return bare ? bare[1] : null;
}

const HELP_TEXT = [
  "🤖 Командууд:",
  "• статус — миний бүртгэлийн товч мэдээ",
  "• гишүүнчлэл — захиалгын хугацаа",
  "• кредит — кредитийн үлдэгдэл",
  "• холбох <6 оронтой код> — Antaqor бүртгэлээ холбох",
  "• human — жинхэнэ хүнтэй ярих",
  "• болих — AI хариу зогсоох",
  "• эхлүүл — AI хариу сэргээх",
  "• тусламж — энэ жагсаалт",
  "",
  "ℹ️ Энэ хэлэлцүүлэг AI агент-тай явагдаж байна.",
].join("\n");

// ─── Main dispatcher ───
export async function tryHandleCommand(
  text: string,
  user: IUser,
  conversationId?: mongoose.Types.ObjectId | string
): Promise<CommandResult> {
  const t = norm(text);
  if (!t) return null;

  // STOP — sets conversation.aiDisabled (compliance with Meta policy)
  if (matchesAny(text, STOP_KW)) {
    if (conversationId) {
      await MetaConversation.findByIdAndUpdate(conversationId, { aiDisabled: true });
    }
    return {
      text: "✓ Боллоо. AI хариу зогссон. Дахин асуухдаа «эхлүүл» гэж бичээрэй.\n\nАливаа санал, гомдол: admin@antaqor.com",
    };
  }

  // START — re-enables
  if (matchesAny(text, RESUME_KW)) {
    if (conversationId) {
      await MetaConversation.findByIdAndUpdate(conversationId, { aiDisabled: false, escalatedToHuman: false });
    }
    return {
      text: "✓ AI хариу дахин идэвхжсэн. Юу асуумаар байна?",
    };
  }

  // HUMAN — escalate to admin. Suspends AI, flags conversation.
  if (wantsHuman(text)) {
    if (conversationId) {
      await MetaConversation.findByIdAndUpdate(conversationId, {
        aiDisabled: true,
        escalatedToHuman: true,
      });
    }
    return {
      text:
        "👤 Боллоо. Manual team рүү шилжүүллээ. Хүнтэй хариулагч 1-4 цагт хариулна (ажлын цагт).\n\nЯаралтай: admin@antaqor.com",
    };
  }

  // IDENTITY — clearly disclose AI status (Meta TOS + MN law compliance)
  if (matchesAny(text, IDENTITY_KW)) {
    return {
      text:
        "Тиймээ, би Antaqor-ын AI agent — жинхэнэ хүн биш. Antaqor (хүн founder)-ын брэнд үнэт зүйлд тулгуурлан хариулдаг.\n\nЖинхэнэ хүнтэй ярих бол «human» гэж бичээрэй.",
    };
  }

  // Link code (priority — could be just digits)
  const code = extractLinkCode(text);
  if (code) {
    return await handleLink(code, user);
  }

  if (matchesAny(text, HELP_KW)) {
    return { text: HELP_TEXT };
  }

  if (matchesAny(text, STATUS_KW)) {
    return { text: statusBlock(user) };
  }

  if (matchesAny(text, SUB_KW)) {
    const days = daysUntil(user.subscriptionExpiresAt);
    if (days > 0) {
      return {
        text: `🎫 Гишүүнчлэл: ${days} хоног үлдсэн.\nДуусах огноо: ${formatDate(user.subscriptionExpiresAt)}\n\nСунгахдаа → antaqor.com/pricing`,
      };
    }
    return {
      text: `🎫 Гишүүнчлэл одоогоор идэвхгүй байна.\nЭхлэхдээ → antaqor.com/pricing`,
    };
  }

  if (matchesAny(text, CREDIT_KW)) {
    return { text: `✦ Таны кредит: ${user.credits ?? 0}\n\nНэмэхдээ → antaqor.com/credits` };
  }


  return null;
}

// ─── Linking ───
async function handleLink(code: string, currentUser: IUser): Promise<CommandResult> {
  const owner = await User.findOne({
    metaLinkCode: code,
    metaLinkCodeExpiresAt: { $gt: new Date() },
  });
  if (!owner) {
    return {
      text: "❌ Код буруу эсвэл хугацаа дууссан байна.\nЗасахдаа antaqor.com/account/link-instagram дээр шинэ код авна уу.",
    };
  }

  if ((owner._id as mongoose.Types.ObjectId).equals(currentUser._id as mongoose.Types.ObjectId)) {
    return { text: "✓ Энэ бүртгэл аль хэдийн холбогдсон байна." };
  }

  const isCurrentGhost = (currentUser.email || "").endsWith("@antaqor.dm");

  if (isCurrentGhost) {
    // Move IG/FB id from ghost → real user, delete ghost
    if (currentUser.metaInstagramId) owner.metaInstagramId = currentUser.metaInstagramId;
    if (currentUser.metaMessengerPsid) owner.metaMessengerPsid = currentUser.metaMessengerPsid;
    owner.metaLinkCode = undefined;
    owner.metaLinkCodeExpiresAt = undefined;
    await owner.save();

    // Re-point conversations from ghost → real user
    await MetaConversation.updateMany(
      { linkedUserId: currentUser._id },
      { linkedUserId: owner._id }
    );

    // Delete the ghost (it has no real data)
    await User.findByIdAndDelete(currentUser._id);
  } else {
    // Both users are real — shouldn't happen via normal flow, but handle defensively
    return {
      text: "❌ Энэ бүртгэл нь өөр Antaqor бүртгэлд хамаарч байна. Хэрэв та эзэн нь бол admin-тэй холбогдоно уу.",
    };
  }

  return {
    text: `✓ Холболт амжилттай.\n\n${statusBlock(owner)}`,
  };
}
