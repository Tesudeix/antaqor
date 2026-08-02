import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaPage from "@/models/MetaPage";

export const dynamic = "force-dynamic";

const APP = process.env.META_FB_APP_ID || "";
const SEC = process.env.META_FB_APP_SECRET || "";
const FB = "https://graph.facebook.com/v21.0";
const FIELDS = "messages,messaging_postbacks,messaging_optins,message_reactions,feed";
const LEGACY = [
  { key: "antaqor", label: "Antaqor" },
  { key: "joymassage", label: "joymassage · @cityandjoy" },
  { key: "joybilliard", label: "Joy billiard · @joy.billiard" },
];

type G = Record<string, unknown>;
async function gj(url: string, init?: RequestInit): Promise<G> {
  try { const r = await fetch(url, init); return (await r.json()) as G; } catch (e) { return { error: { message: String(e) } }; }
}
async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const pages = await MetaPage.find({}).select("key pageId name igBusinessId pageType enabled").sort({ createdAt: -1 }).lean();
  const accounts = [...LEGACY, ...pages.map((p) => ({ key: p.key, label: p.name || p.pageId }))];
  return NextResponse.json({ pages, accounts });
}

export async function POST(req: Request) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as G;
  const token = String(b.token || "").trim();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
  if (!APP || !SEC) return NextResponse.json({ error: "App credentials missing on server" }, { status: 500 });

  const ex = await gj(`${FB}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP}&client_secret=${SEC}&fb_exchange_token=${encodeURIComponent(token)}`);
  const ll = (ex.access_token as string) || token;

  if (!b.pageId) {
    const acc = await gj(`${FB}/me/accounts?fields=id,name,instagram_business_account%7Bid,username%7D&access_token=${encodeURIComponent(ll)}`);
    const data = acc.data as Array<G> | undefined;
    if (Array.isArray(data) && data.length) {
      return NextResponse.json({ managePages: data.map((p) => ({ id: p.id, name: p.name, ig: ((p.instagram_business_account as G)?.id as string) || "" })) });
    }
    const me = await gj(`${FB}/me?fields=id,name&access_token=${encodeURIComponent(ll)}`);
    if (me.id) return NextResponse.json({ managePages: [{ id: me.id, name: me.name || me.id, ig: "" }] });
    return NextResponse.json({ error: ((acc.error as G)?.message as string) || "cannot list pages" }, { status: 400 });
  }

  const pageId = String(b.pageId);
  let pageToken = "";
  const acc = await gj(`${FB}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(ll)}`);
  const data = acc.data as Array<G> | undefined;
  if (Array.isArray(data)) { const hit = data.find((p) => p.id === pageId); if (hit) pageToken = hit.access_token as string; }
  if (!pageToken) {
    const me = await gj(`${FB}/me?fields=id&access_token=${encodeURIComponent(ll)}`);
    if (me.id === pageId) pageToken = ll;
  }
  if (!pageToken) return NextResponse.json({ error: "Энэ page-ийн token олдсонгүй" }, { status: 400 });

  const info = await gj(`${FB}/${pageId}?fields=name,instagram_business_account%7Bid%7D&access_token=${encodeURIComponent(pageToken)}`);
  const name = (info.name as string) || pageId;
  const igBusinessId = ((info.instagram_business_account as G)?.id as string) || "";

  const sub = await gj(`${FB}/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: FIELDS, access_token: pageToken }).toString(),
  });

  await dbConnect();
  const doc = await MetaPage.findOneAndUpdate(
    { pageId },
    { key: pageId, pageId, name, igBusinessId, pageType: typeof b.pageType === "string" ? b.pageType : "other", pageAccessToken: pageToken, enabled: true, connectedByEmail: s.user?.email || "" },
    { new: true, upsert: true }
  );
  return NextResponse.json({ ok: true, page: { key: doc.key, pageId, name, igBusinessId }, subscribed: sub.success === true });
}

export async function PATCH(req: Request) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as G;
  await dbConnect();
  await MetaPage.updateOne({ key: String(b.key) }, { enabled: b.enabled !== false });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = new URL(req.url).searchParams.get("key") || "";
  await dbConnect();
  await MetaPage.deleteOne({ key });
  return NextResponse.json({ ok: true });
}
