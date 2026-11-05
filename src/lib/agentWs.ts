import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { SUPER_ADMIN_EMAILS } from "@/lib/adminAuth";
import { AgentWorkspace, AgentConn, type IAgentWorkspace } from "@/models/AgentWorkspace";
import { ymd } from "@/lib/contentAgentRules";

/* ─── Workspace (түрээслэгч) контекст — Antaqor Agent ──────────────────────
   2026-10-26 (эзний шийдвэр): хоёр түвшин, туршилтгүй.
   · ГИШҮҮН — Antaqor-ийн төлбөртэй гишүүн. Зөвхөн AI зураг + AI ихэр, өдөрт
     10 бүтээлт; бүтээлээ antaqor.com community-д хуваалцана. Бизнесийн хуудас
     (холболт, студи, хуанли…) харагдахгүй.
   · БИЗНЕС — 99,000₮/сар (QPay). Бүх боломж. Төлбөр → paidUntil +30 хоног.
   · Админ (эзэн, багийнхан) → "main" (хуучин өгөгдөл).
   · Өмнө нь эхэлсэн 14 хоногийн туршилтууд (2026-10-24) дуустлаа бизнес горимоор.
   Супер админ ?as=<wsId>-ээр түрээслэгчийн workspace-ийг дэмжлэгт нээж болно. */

export const MAIN = "main";
export const TRIAL_DAYS = 14;
export const TRIAL_SLOTS = 100;
export const TRIAL_GENS_PER_DAY = 25;
export const TRIAL_MEDIA_USD = 1;
/* 2026-10-26: гишүүн бүтээлт бүрээ КРЕДИТЭЭР төлнө (studioCredits) — энэ нь зөвхөн
   хэт ашиглалтаас сэргийлэх хамгаалалт (vision шинжилгээ кредитгүй). */
export const MEMBER_GENS_PER_DAY = 60;
export const BUSINESS_PRICE = 99_000;
export const BUSINESS_DAYS = 30;
/* Бизнес багц эзний Higgsfield данснаас зарцуулна — 99,000₮ (~$29) сард
   өдрийн $200 зөвшөөрөх нь алдагдал. Өдөрт $2, 60 бүтээлт хүртэл. */
export const BUSINESS_GENS_PER_DAY = 60;
export const BUSINESS_MEDIA_USD = 2;

type WsLean = Omit<IAgentWorkspace, keyof import("mongoose").Document>;
export type Plan = "owner" | "trial" | "active" | "expired" | "waitlist" | "member" | "none";
/** business = бүх боломж (эзэн/бизнес/туршилт, дууссан бизнес нь зөвхөн үзнэ); member = зураг + ихэр; none = эрхгүй */
export type Mode = "business" | "member" | "none";
export type WsCtx = {
  ws: string; userId: string; email: string; name: string;
  superAdmin: boolean; admin: boolean; plan: Plan; daysLeft: number; workspace: WsLean | null; viewingAs: boolean;
  mode: Mode; isMember: boolean;
};

export function planOf(w: WsLean | null): { plan: Plan; daysLeft: number } {
  if (!w) return { plan: "none", daysLeft: 0 };
  if (w.plan === "active") {
    /* paidUntil-гүй active = супер админ гараар нээсэн (хугацаагүй) */
    if (!w.paidUntil) return { plan: "active", daysLeft: 0 };
    const left = Math.ceil((+new Date(w.paidUntil) - Date.now()) / 864e5);
    return left > 0 ? { plan: "active", daysLeft: left } : { plan: "expired", daysLeft: 0 };
  }
  if (w.plan === "member") return { plan: "member", daysLeft: 0 };
  if (w.plan === "waitlist") return { plan: "waitlist", daysLeft: 0 };
  const left = w.trialEndsAt ? Math.ceil((+new Date(w.trialEndsAt) - Date.now()) / 864e5) : 0;
  return left > 0 && w.plan === "trial" ? { plan: "trial", daysLeft: left } : { plan: "expired", daysLeft: 0 };
}

/** Бизнесийн бүх боломж нээлттэй юу (бичих эрхтэй) */
export const bizOpen = (p: Plan) => p === "owner" || p === "active" || p === "trial";

async function activeMember(userId: string): Promise<boolean> {
  const User = (await import("@/models/User")).default;
  const u = await User.findById(userId).select("subscriptionExpiresAt").lean<{ subscriptionExpiresAt?: Date }>();
  return !!(u?.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date());
}

export async function wsContext(req?: NextRequest): Promise<WsCtx | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; email?: string | null; name?: string | null } | undefined;
  if (!user?.id) return null;
  await dbConnect();
  const email = (user.email || "").toLowerCase();
  const superAdmin = SUPER_ADMIN_EMAILS.includes(email);
  let admin = superAdmin;
  if (!admin) {
    const User = (await import("@/models/User")).default;
    admin = (await User.findOne({ email }).select("role").lean<{ role?: string }>())?.role === "admin";
  }
  const base = { userId: String(user.id), email, name: user.name || "", superAdmin, admin };
  const as = superAdmin ? req?.nextUrl.searchParams.get("as") || "" : "";
  if (as && as !== MAIN) {
    const w = await AgentWorkspace.findOne({ wsId: as }).lean<WsLean>();
    if (w) { const p = planOf(w); return { ...base, ws: w.wsId, workspace: w, viewingAs: true, ...p, mode: p.plan === "member" ? "member" : "business", isMember: false }; }
  }
  if (admin) return { ...base, ws: MAIN, workspace: null, plan: "owner", daysLeft: 0, viewingAs: false, mode: "business", isMember: true };

  let w = await AgentWorkspace.findOne({ ownerUserId: base.userId }).lean<WsLean>();
  const p = planOf(w);
  const isMember = await activeMember(base.userId);
  if (w) AgentWorkspace.updateOne({ wsId: w.wsId }, { $set: { lastActiveAt: new Date() } }).catch(() => {});

  /* Бизнес (идэвхтэй/туршилт) — бүх боломж */
  if (w && bizOpen(p.plan)) return { ...base, ws: w.wsId, workspace: w, viewingAs: false, ...p, mode: "business", isMember };
  /* Гишүүн — workspace байхгүй бол чимээгүй үүсгэнэ (онбординг шаардахгүй) */
  if (isMember) {
    if (!w) w = await createMemberWorkspace(base.userId, email, base.name);
    return { ...base, ws: w.wsId, workspace: w, viewingAs: false, ...planOf(w), mode: "member", isMember };
  }
  /* Хугацаа нь дууссан бизнес — өгөгдлөө үзэж, сунгах товчтой (бичихгүй) */
  if (w && p.plan === "expired") return { ...base, ws: w.wsId, workspace: w, viewingAs: false, ...p, mode: "business", isMember };
  return { ...base, ws: "", workspace: w, viewingAs: false, ...p, mode: "none", isMember };
}

/** Бичих эрх: эзэн, идэвхтэй бизнес, туршилт, гишүүн. Дууссан бизнес зөвхөн үзнэ. */
export function canWrite(c: WsCtx): string | null {
  if (!c.ws) return "Гишүүнчлэл эсвэл бизнес багц шаардлагатай";
  if (c.mode === "business" && c.plan === "expired") return "Бизнес багцын хугацаа дууссан — 99,000₮-өөр сунгана уу";
  return null;
}

/** AI бүтээлтийн өдрийн тоолуур — бизнес 60, туршилт 25, гишүүн 10. Эзэн хязгааргүй. */
export async function useGen(ws: string, n = 1): Promise<void> {
  if (ws === MAIN) return;
  const w = await AgentWorkspace.findOne({ wsId: ws }).select("plan usage trialEndsAt paidUntil").lean<WsLean>();
  if (!w) return;
  const p = planOf(w).plan;
  const cap = p === "active" ? BUSINESS_GENS_PER_DAY : p === "trial" ? TRIAL_GENS_PER_DAY : MEMBER_GENS_PER_DAY;
  const today = ymd(new Date());
  const used = w.usage?.day === today ? w.usage.gens : 0;
  if (used + n > cap) throw new Error(`Өнөөдрийн хязгаар (${cap} бүтээлт) хүрлээ — маргааш дахин боломжтой`);
  await AgentWorkspace.updateOne({ wsId: ws }, { $set: { "usage.day": today, "usage.gens": used + n }, $inc: { "usage.total": n } });
}

/** Өнөөдөр үлдсэн бүтээлт (UI-д) — эзэн бол null */
export function gensLeft(c: WsCtx): number | null {
  if (c.ws === MAIN || !c.workspace) return null;
  const cap = c.plan === "active" ? BUSINESS_GENS_PER_DAY : c.plan === "trial" ? TRIAL_GENS_PER_DAY : MEMBER_GENS_PER_DAY;
  const w = c.workspace;
  return Math.max(0, cap - (w.usage?.day === ymd(new Date()) ? w.usage.gens : 0));
}

export async function trialSeats(): Promise<{ used: number; left: number }> {
  await dbConnect();
  const used = await AgentWorkspace.countDocuments({ plan: { $in: ["trial", "active", "expired"] } });
  return { used, left: Math.max(0, TRIAL_SLOTS - used) };
}

const newWsId = () => `w${randomBytes(6).toString("hex")}`;

/** Гишүүний workspace — бизнесийн профайлгүй, зөвхөн зураг/ихрийн өгөгдөл тусгаарлах сав. */
export async function createMemberWorkspace(userId: string, email: string, name: string): Promise<WsLean> {
  try {
    const doc = await AgentWorkspace.create({
      wsId: newWsId(), name: name || email.split("@")[0], ownerUserId: userId, ownerEmail: email, ownerName: name,
      plan: "member", trialEndsAt: null, business: { name: name || "", about: "" },
    });
    return doc.toObject() as unknown as WsLean;
  } catch {
    /* зэрэг хоёр хүсэлт — ownerUserId unique; ялсныг нь буцаана */
    return (await AgentWorkspace.findOne({ ownerUserId: userId }).lean<WsLean>())!;
  }
}

/** Бизнесийн профайл (төлбөрийн дараах онбординг) — workspace аль хэдийн бий. */
export async function saveBusiness(ws: string, b: { name: string; about: string; audience?: string; tone?: string; brandColor?: string; logoUrl?: string; website?: string; contact?: string }) {
  const business = { name: b.name.trim().slice(0, 80), about: b.about.trim().slice(0, 1500), audience: (b.audience || "").slice(0, 600), tone: (b.tone || "").slice(0, 120), brandColor: /^#[0-9a-f]{6}$/i.test(b.brandColor || "") ? b.brandColor! : "", logoUrl: (b.logoUrl || "").slice(0, 300), website: (b.website || "").slice(0, 200), contact: (b.contact || "").slice(0, 200) };
  await AgentWorkspace.updateOne({ wsId: ws }, { $set: { business, name: business.name } });
  return business;
}

/** Бизнес багцын төлбөр баталгаажмагц — workspace-ийг идэвхжүүлж хугацааг сунгана (байхгүй бол үүсгэнэ). */
export async function activateBusiness(userId: string, days: number, who: { email: string; name: string }): Promise<{ wsId: string; paidUntil: Date }> {
  await dbConnect();
  const w = await AgentWorkspace.findOne({ ownerUserId: userId }).lean<WsLean>();
  const now = Date.now();
  const from = w?.plan === "active" && w.paidUntil && +new Date(w.paidUntil) > now ? +new Date(w.paidUntil) : now;
  const paidUntil = new Date(from + days * 864e5);
  if (w) {
    await AgentWorkspace.updateOne({ wsId: w.wsId }, { $set: { plan: "active", paidUntil } });
    return { wsId: w.wsId, paidUntil };
  }
  const wsId = newWsId();
  await AgentWorkspace.create({ wsId, name: who.name || who.email.split("@")[0], ownerUserId: userId, ownerEmail: who.email, ownerName: who.name, plan: "active", paidUntil, trialEndsAt: null, business: { name: "", about: "" } });
  return { wsId, paidUntil };
}

export async function getBusiness(ws: string): Promise<WsLean["business"] | null> {
  if (ws === MAIN) return null;
  return (await AgentWorkspace.findOne({ wsId: ws }).select("business").lean<WsLean>())?.business || null;
}

/** Тухайн workspace-ийн холбосон аккаунтууд (түрээслэгч) — токенгүй */
export async function wsConns(ws: string) {
  const rows = await AgentConn.find({ ws }).sort({ createdAt: 1 }).lean();
  return {
    meta: rows.filter((r) => r.platform === "meta").map((r) => ({ key: r.key, label: r.label, pageId: r.pageId, igId: r.igId, igUsername: r.igUsername, status: r.status })),
    threads: rows.filter((r) => r.platform === "threads").map((r) => ({ id: r.threadsUserId, username: r.username, status: r.status })),
  };
}
