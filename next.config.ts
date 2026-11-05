import type { NextConfig } from "next";

// Next.js 16 truncates request bodies past 10MB by default. Lesson video
// uploads run up to 200MB; nginx is set to 250M. The right knob in 16.1
// lives under experimental.proxyClientMaxBodySize. Cast around the missing
// type until @types/next ships it.
const nextConfig: NextConfig = {
  serverExternalPackages: ["livekit-server-sdk"],
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    ...({ proxyClientMaxBodySize: "250mb" } as Record<string, unknown>),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "antaqor.com",
      },
      {
        protocol: "https",
        hostname: "*.antaqor.com",
      },
    ],
  },
  /* Видео студи /tools/runway -> /tools/video болов (2026-09-22).
     Хуучин хаяг нь bookmark, хуваалцсан холбоос, гадаад сайтууд дээр
     үлдсэн тул 301-ээр чиглүүлнэ — 404 болгохгүй. */
  async redirects() {
    return [
      { source: "/tools/runway", destination: "/tools/video", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/policy", destination: "/policy.html" },
      { source: "/privacy-policy", destination: "/policy.html" },
      { source: "/privacy", destination: "/policy.html" },
      { source: "/terms", destination: "/terms.html" },
      { source: "/data-deletion", destination: "/data-deletion.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/admin/live",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=()" }],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://antaqor.com" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
