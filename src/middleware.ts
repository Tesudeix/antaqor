import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip;
}

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return false;
  }

  entry.count++;
  if (entry.count > maxRequests) return true;
  return false;
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }, 60000);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth read endpoints (session, providers, csrf, _log) — no rate limit
  if (
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/providers" ||
    pathname === "/api/auth/csrf" ||
    pathname === "/api/auth/_log"
  ) {
    return NextResponse.next();
  }

  // Auth write endpoints — strict: 20 req/min
  if (pathname.startsWith("/api/auth")) {
    const key = `auth:${getRateLimitKey(req)}`;
    if (isRateLimited(key, 20, 60000)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  // Upload endpoints — strict: 10 req/min
  if (pathname.startsWith("/api/upload")) {
    const key = `upload:${getRateLimitKey(req)}`;
    if (isRateLimited(key, 10, 60000)) {
      return NextResponse.json(
        { error: "Too many uploads. Please slow down." },
        { status: 429 }
      );
    }
  }

  // Admin API — 60 req/min
  if (pathname.startsWith("/api/admin")) {
    const key = `admin:${getRateLimitKey(req)}`;
    if (isRateLimited(key, 60, 60000)) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 }
      );
    }
  }

  // General API: 100 requests per minute
  if (pathname.startsWith("/api/")) {
    const key = `api:${getRateLimitKey(req)}`;
    if (isRateLimited(key, 100, 60000)) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }
  }

  // Block suspicious patterns
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

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sw.js|manifest.json|uploads/).*)",
  ],
};
