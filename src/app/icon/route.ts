import { NextResponse } from "next/server";
import { readBrandFile } from "@/lib/siteBrand";

/* /icon — хуучин `app/icon.tsx`-ийн зам (sw.js-ийн push badge гэх мэт ашигладаг). Одоо брэндийн icon. */
export const dynamic = "force-dynamic";

export async function GET() {
  const f = await readBrandFile("icon-192.png");
  if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(f.body), { headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" } });
}
