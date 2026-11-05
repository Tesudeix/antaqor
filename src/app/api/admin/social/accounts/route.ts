import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import { listMetaTargets, type MetaTarget } from "@/lib/socialPublish";
import { ThreadsAPI } from "@/lib/threads";

export const dynamic = "force-dynamic";

const FB = "https://graph.facebook.com/v21.0";
const IG_LOGIN = "https://graph.instagram.com/v21.0";

type J = Record<string, unknown>;
type Health = { ok: boolean; label: string; error: string };

// Token checks hit Meta on every page load otherwise; 60s is short enough that
// a reconnect shows up almost immediately.
const CACHE_TTL = 60_000;
let cache: { at: number; body: unknown } | null = null;

async function probe(url: string): Promise<J> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    return (await r.json()) as J;
  } catch (e) {
    return { error: { message: String(e) } };
  }
}

function msg(j: J): string {
  const e = j.error as J | undefined;
  return e ? String(e.message || "алдаа") : "";
}

// Scopes actually granted on a page token. A page that reads fine can still be
// unable to post, so the composer must check the capability it is about to use
// rather than mere reachability — otherwise it shows a green light for an
// action that is guaranteed to fail.
const scopeCache = new Map<string, { at: number; scopes: Set<string> }>();

async function tokenScopes(token: string): Promise<Set<string>> {
  const hit = scopeCache.get(token);
  if (hit && Date.now() - hit.at < 60_000) return hit.scopes;
  const id = process.env.META_FB_APP_ID || "";
  const sec = process.env.META_FB_APP_SECRET || "";
  if (!id || !sec) return new Set();
  const app = await probe(`${FB}/oauth/access_token?client_id=${id}&client_secret=${sec}&grant_type=client_credentials`);
  const appTok = String(app.access_token || "");
  if (!appTok) return new Set();
  const dbg = await probe(`${FB}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appTok)}`);
  const data = (dbg.data || {}) as J;
  const scopes = new Set<string>(Array.isArray(data.scopes) ? (data.scopes as string[]) : []);
  scopeCache.set(token, { at: Date.now(), scopes });
  return scopes;
}

async function checkFacebook(t: MetaTarget): Promise<Health> {
  if (!t.pageId || !t.pageToken) return { ok: false, label: "", error: "Хуудас холбоогүй" };
  const r = await probe(`${FB}/${t.pageId}?fields=name&access_token=${encodeURIComponent(t.pageToken)}`);
  if (r.error) return { ok: false, label: "", error: msg(r) };
  const scopes = await tokenScopes(t.pageToken);
  if (scopes.size && !scopes.has("pages_manage_posts")) {
    return {
      ok: false,
      label: String(r.name || t.pageId),
      error: "Нийтлэх эрх дутуу: pages_manage_posts. Token дахин үүсгэнэ үү.",
    };
  }
  return { ok: true, label: String(r.name || t.pageId), error: "" };
}

async function checkInstagram(t: MetaTarget): Promise<Health> {
  const token = t.igToken;
  if (!token) return { ok: false, label: "", error: "Instagram холбоогүй" };
  if (token.startsWith("IGAA")) {
    const r = await probe(`${IG_LOGIN}/me?fields=id,username&access_token=${encodeURIComponent(token)}`);
    if (r.error) return { ok: false, label: "", error: msg(r) };
    return { ok: true, label: `@${String(r.username || "")}`, error: "" };
  }
  if (!t.igId) return { ok: false, label: "", error: "Энэ хуудсанд IG бизнес акаунт холбоогүй" };
  const r = await probe(`${FB}/${t.igId}?fields=username&access_token=${encodeURIComponent(token)}`);
  if (r.error) return { ok: false, label: "", error: msg(r) };
  const scopes = await tokenScopes(token);
  if (scopes.size && !scopes.has("instagram_content_publish")) {
    return {
      ok: false,
      label: `@${String(r.username || t.igId)}`,
      error: "Нийтлэх эрх дутуу: instagram_content_publish.",
    };
  }
  return { ok: true, label: `@${String(r.username || t.igId)}`, error: "" };
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  if (!req.nextUrl.searchParams.get("fresh") && cache && Date.now() - cache.at < CACHE_TTL) {
    return NextResponse.json(cache.body);
  }

  const metaTargets = await listMetaTargets();
  const targets = await Promise.all(
    metaTargets.map(async (t) => ({
      key: t.key,
      label: t.label,
      pageId: t.pageId,
      igId: t.igId,
      ...await (async () => { const [facebook, instagram] = await Promise.all([checkFacebook(t), checkInstagram(t)]); return { facebook, instagram }; })(),
    }))
  );

  await dbConnect();
  const tokens = await ThreadsToken.find({})
    .select("threadsUserId username status expiresAt accessToken")
    .sort({ createdAt: 1 })
    .lean<{ threadsUserId: string; username?: string; status?: string; expiresAt: Date; accessToken: string }[]>();

  const threads = await Promise.all(
    tokens.map(async (t) => {
      const expired = new Date(t.expiresAt).getTime() < Date.now();
      let ok = t.status !== "reconnect_needed" && !expired;
      let error = expired ? "Token хугацаа дууссан" : t.status === "reconnect_needed" ? "Дахин холбох шаардлагатай" : "";
      if (ok) {
        try {
          await new ThreadsAPI(t.accessToken, t.threadsUserId).getProfile();
        } catch (e) {
          ok = false;
          error = e instanceof Error ? e.message : "Token шалгаж чадсангүй";
        }
      }
      return {
        threadsUserId: t.threadsUserId,
        username: t.username || "",
        status: t.status || "active",
        expiresAt: t.expiresAt,
        ok,
        error,
      };
    })
  );

  const body = {
    targets,
    threads,
    metaConfigured: Boolean(process.env.META_FB_APP_ID && process.env.META_FB_APP_SECRET),
    threadsConfigured: Boolean(process.env.THREADS_APP_ID && process.env.THREADS_REDIRECT_URI),
    connect: { meta: "/api/admin/meta/oauth/start", threads: "/api/admin/threads/auth" },
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
