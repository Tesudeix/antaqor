import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import CreditTx from "@/models/CreditTx";
import Plan from "@/models/Plan";
import { AgentMedia } from "@/models/AgentStudio";
import { hfCost } from "@/lib/hfMedia";
import { CREDIT_PACKAGES } from "@/lib/creditPackages";
import { getEcon, saveEcon } from "@/lib/creditEconomicsServer";

/* Ашиг · Кредит (/admin/economics) — GET: тохиргоо + үйлдлийн $ өртөг + багц +
   гишүүнчлэлийн үнэ + сүүлийн 30 хоногийн БОДИТ орлого/зардал. PUT: тохиргоо. */
export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

const ACTIONS: { label: string; usd: () => number; group: string }[] = [
  { label: "Z-Image Turbo · 1K", usd: () => hfCost("zimage", { res: "1k", dur: 0 }), group: "AI зураг" },
  { label: "GPT Image 2 · 1K · Хурдан", usd: () => hfCost("gpt2", { res: "1k", dur: 0, q: "low" }), group: "AI зураг" },
  { label: "GPT Image 2 · 1K · Сайн", usd: () => hfCost("gpt2", { res: "1k", dur: 0, q: "medium" }), group: "AI зураг" },
  { label: "GPT Image 2 · 2K · Сайн", usd: () => hfCost("gpt2", { res: "2k", dur: 0, q: "medium" }), group: "AI зураг" },
  { label: "GPT Image 2.5 · 1K · Сайн", usd: () => hfCost("gpt25", { res: "1k", dur: 0, q: "medium" }), group: "AI зураг" },
  { label: "Grok Imagine 2 · 1K", usd: () => hfCost("grok2", { res: "1k", dur: 0 }), group: "AI зураг" },
  { label: "Нэг sheet (Flare)", usd: () => hfCost("flare", { res: "medium", dur: 0 }), group: "AI ихэр" },
  { label: "Wan 3.0 · 5с · 720p", usd: () => hfCost("wan3", { res: "720p", dur: 5 }), group: "AI видео" },
  { label: "Kling 3.0 · 5с · 720p", usd: () => hfCost("kling3", { res: "720p", dur: 5 }), group: "AI видео" },
  { label: "Kling 4.0 · 5с · 720p", usd: () => hfCost("kling4", { res: "720p", dur: 5 }), group: "AI видео" },
  { label: "Kling 4.0 · 10с · 1080p", usd: () => hfCost("kling4", { res: "1080p", dur: 10 }), group: "AI видео" },
  { label: "Seedance 2.5 · 5с · 720p", usd: () => hfCost("seedance25", { res: "720p", dur: 5 }), group: "AI видео" },
];

const sum = async (match: Record<string, unknown>, field = "$amount") =>
  (await Payment.aggregate([{ $match: match }, { $group: { _id: null, s: { $sum: field }, n: { $sum: 1 } } }]))[0] || { s: 0, n: 0 };

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const since = new Date(Date.now() - 30 * 864e5);
  const paid = { status: "paid", updatedAt: { $gte: since } };
  const adminIds = (await User.find({ $or: [{ role: "admin" }, { email: { $in: ["antaqor@gmail.com", "cyberempire4444@gmail.com"] } }] }).select("_id").lean()).map((u) => u._id);
  const [econ, plans, membership, credits, agent, outstanding, hf, txAgg] = await Promise.all([
    getEcon(),
    Plan.find({}).select("planId name price").lean<{ planId: string; name?: string; price?: number }[]>(),
    sum({ ...paid, kind: { $in: ["membership", null] } }),
    sum({ ...paid, kind: "credits" }),
    sum({ ...paid, kind: "agent" }),
    User.aggregate([{ $match: { credits: { $gt: 0 }, _id: { $nin: adminIds } } }, { $group: { _id: null, s: { $sum: "$credits" }, n: { $sum: 1 } } }]),
    AgentMedia.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: "failed" } } },
      { $group: { _id: { $cond: [{ $gt: ["$credits", 0] }, "member", { $cond: [{ $eq: ["$ws", "main"] }, "owner", "business"] }] }, usd: { $sum: "$usd" }, n: { $sum: 1 }, credits: { $sum: "$credits" } } },
    ]),
    CreditTx.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { k: "$kind", r: "$reason" }, s: { $sum: "$amount" }, n: { $sum: 1 } } },
    ]),
  ]);
  const tx = (k: string, r: string) => txAgg.find((x) => x._id.k === k && x._id.r === r) || { s: 0, n: 0 };
  return NextResponse.json({
    econ,
    actions: ACTIONS.map((a) => ({ label: a.label, group: a.group, usd: Math.round(a.usd() * 10000) / 10000 })),
    packages: CREDIT_PACKAGES.map((p) => ({ id: p.id, label: p.label, price: p.price, credits: p.credits })),
    plans: plans.filter((p) => (p.price || 0) > 0).map((p) => ({ planId: p.planId, name: p.name || p.planId, price: p.price || 0 })),
    last30: {
      revenue: { membership: membership.s, membershipN: membership.n, credits: credits.s, creditsN: credits.n, agent: agent.s, agentN: agent.n },
      hf: hf.map((h) => ({ who: h._id, usd: Math.round(h.usd * 100) / 100, n: h.n, credits: h.credits })),
      gifts: { signup: tx("earn", "SIGNUP_BONUS").s, membership: tx("earn", "MEMBERSHIP_BONUS").s },
      studioSpend: tx("spend", "AI_STUDIO").s - tx("earn", "AI_STUDIO_REFUND").s,
    },
    outstanding: { credits: outstanding[0]?.s || 0, users: outstanding[0]?.n || 0 },
  });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Буруу өгөгдөл" }, { status: 400 });
  return NextResponse.json({ econ: await saveEcon(body) });
}
