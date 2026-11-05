import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── In-memory rate limit (per-process) ─────────────────────────────────
// Keyed by bucket+IP. For multi-process deploys this is per-instance, which
// is acceptable for abuse floors — strict per-route checks live in the route
// handlers (e.g. spendCredits + AI_TOOL_PER_MINUTE) where they belong.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

function check(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  entry.count++;
  if (entry.count > max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetTime - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

function tooMany(message: string, retryAfter: number) {
  return NextResponse.json(
    { error: message, retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(retryAfter),
      },
    }
  );
}

// Periodic GC so the map doesn't grow unbounded
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }, 60000);
}

// Endpoints that long-poll from the client and shouldn't count against the
// floor. They are already protected by NextAuth at the route level.
const POLLING_GET_PREFIXES = [
  "/api/broadcast",
  "/api/auth/session",
  "/api/auth/providers",
  "/api/auth/csrf",
  "/api/auth/_log",
  "/api/notifications",
  "/api/credits",        // polled by /credits/buy and the AI tool balance pill
  "/api/posts",          // feed + community
  "/api/membership",
  "/api/clan/payment-status",
  "/api/clan/check",
  "/api/stats",
];

function isPollingRead(req: NextRequest, pathname: string): boolean {
  if (req.method !== "GET") return false;
  return POLLING_GET_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

/* Тусдаа домэйн дээрх апп-ууд (trader 2026-10-31, studio 2026-11-01). Ижил Next апп:
   "/" → home руу дотооддоо rewrite, home → "/" (308), API/файл хэвээр, `keep`-д
   таарсан хуудас (нэвтрэх, кредит) тэр хост дээрээ, бусад нь antaqor.com руу.
   antaqor.com/<home> → тэр домэйн гэсэн 301 нь nginx-д (snippets/antaqor-app.conf). */
const SUB_APPS: Record<string, { home: string; keep: RegExp }> = {
  "trader.antaqor.com": { home: "/trader-agent", keep: /^\/auth(\/|$)/ },
  "studio.antaqor.com": { home: "/content-agent", keep: /^\/(auth|credits)(\/|$)/ },
};

const AI_TOOL_PAGE = /^\/tools\/(video|nano-banano|generate-image|brand-shot|character-sheet|compose|extract-product|swap-product)(\/|$)/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Block suspicious patterns up front ─────────────────────────────────
  if (
    pathname.includes("..") ||
    pathname.includes(".env") ||
    pathname.includes(".git") ||
    pathname.includes(".svn") ||
    pathname.includes("wp-admin") ||
    pathname.includes("wp-login") ||
    pathname.includes("wp-content") ||
    pathname.includes("xmlrpc") ||
    pathname.includes("phpmyadmin") ||
    /\.(php|asp|aspx|jsp|cgi|sql|bak|old|orig|swp)$/i.test(pathname)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const host = (req.headers.get("host") || "").split(":")[0];
  /* Чат 2026-11-02-нд бүрэн хасагдав (эзний хүсэлт): хуучин холбоос нүүр рүү. Өгөгдөл Mongo-д хэвээр. */
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return NextResponse.redirect(new URL("/", req.url), 307);
  const sub = SUB_APPS[host];
  if (sub) {
    if (pathname === sub.home) {
      return NextResponse.redirect(`https://${host}/${req.nextUrl.search}`, 308);
    }
    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = sub.home;
      return withSecurityHeaders(NextResponse.rewrite(url));
    }
    if (!pathname.startsWith("/api/") && !/\.[a-z0-9]+$/i.test(pathname) && !sub.keep.test(pathname)) {
      return NextResponse.redirect(`https://antaqor.com${pathname}${req.nextUrl.search}`, 307);
    }
  }

  /* AI зураг / видеоны хуучин хэрэгслүүд (2026-10-26, эзний хүсэлт) antaqor.com-оос
     хасагдсан. Хуучин холбоос, хадгалсан хуудас → Antaqor Agent-ийн AI зураг. */
  if (AI_TOOL_PAGE.test(pathname)) {
    const url = req.nextUrl.clone();
    const prompt = req.nextUrl.searchParams.get("prompt");
    url.pathname = "/content-agent";
    url.search = "";
    url.searchParams.set("v", "image");
    if (prompt) url.searchParams.set("prompt", prompt.slice(0, 2000));
    return NextResponse.redirect(url, 307);
  }

  if (pathname.startsWith("/api/")) {
    const ip = getRateLimitKey(req);

    // Auth WRITE endpoints (sign-in/sign-up posts) — strict
    if (pathname.startsWith("/api/auth/") && req.method !== "GET") {
      const r = check(`auth:${ip}`, 30, 60_000);
      if (!r.ok) return tooMany("Дэндүү олон удаа оролдлоо. 1 минутын дараа дахин үзнэ үү.", r.retryAfter);
      return withSecurityHeaders(NextResponse.next());
    }

    // High-frequency safe READS that the UI polls — never block these on the
    // global floor; their own handlers do session-level checks. Otherwise an
    // open feed + chat + balance-pill could trip a single user.
    if (isPollingRead(req, pathname)) {
      return withSecurityHeaders(NextResponse.next());
    }

    // Chunked course videos send up to 512 bounded, admin-authenticated parts.
    if (pathname === "/api/classroom/video-upload") {
      const r = check(`course-upload:${ip}`, 720, 60_000);
      if (!r.ok) return tooMany("Видео илгээх хүсэлт хэтэрлээ.", r.retryAfter);
      return withSecurityHeaders(NextResponse.next());
    }

    // Upload — strict per-IP, route handler also enforces per-user/day caps
    if (pathname.startsWith("/api/upload")) {
      const r = check(`upload:${ip}`, 15, 60_000);
      if (!r.ok) return tooMany("Дэндүү олон зураг хадгаллаа. Хэдхэн секундийн дараа дахин үзнэ үү.", r.retryAfter);
    }

    // AI tools — let the route handler enforce the real cap
    // (AI_TOOL_PER_MINUTE + credit-spend gate). Middleware only enforces a
    // generous IP floor so a single abuser can't hammer Gemini.
    else if (pathname.startsWith("/api/tools/")) {
      const r = check(`tools:${ip}`, 30, 60_000);
      if (!r.ok) return tooMany("Дэндүү олон AI хүсэлт. Хэсэг хүлээгээд дахин үзнэ үү.", r.retryAfter);
    }

    // Admin API — moderate per-IP cap (real protection is the isAdmin check)
    else if (pathname.startsWith("/api/admin")) {
      const r = check(`admin:${ip}`, 120, 60_000);
      if (!r.ok) return tooMany("Дэндүү олон хүсэлт.", r.retryAfter);
    }

    // Everyone else — generous per-IP floor for shared-NAT users
    else {
      const r = check(`api:${ip}`, 240, 60_000);
      if (!r.ok) return tooMany("Дэндүү олон хүсэлт. Хуудсаа сэргээгээд дахин үзнэ үү.", r.retryAfter);
    }
  }

  return withSecurityHeaders(NextResponse.next(), pathname === "/admin/live");
}

function withSecurityHeaders(response: NextResponse, allowCapture = false): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", allowCapture ? "camera=(self), microphone=(self), display-capture=(self), geolocation=()" : "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sw.js|manifest.json|uploads/).*)",
  ],
};
