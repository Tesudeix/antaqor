import { NextResponse } from "next/server";
import { readBrandFile } from "@/lib/siteBrand";

/* /favicon.ico — хөтөч, Google шууд энэ замыг асуудаг. Брэндийн 32px icon (PNG; бүх хөтөч хүлээж авна). */
export const dynamic = "force-dynamic";

export async function GET() {
  const f = await readBrandFile("icon-32.png");
  if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(f.body), { headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } });
}
