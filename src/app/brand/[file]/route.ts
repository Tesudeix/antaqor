import { NextRequest, NextResponse } from "next/server";
import { readBrandFile } from "@/lib/siteBrand";

/* /brand/<icon-32.png|icon-192.png|icon-512.png|maskable-*.png|apple-touch-icon.png|cover>
   Админы /admin/brand-аас оруулсан icon/cover (байхгүй бол public/ дахь анхдагч). */
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const f = await readBrandFile(file);
  if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(f.body), {
    headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=600, stale-while-revalidate=86400" },
  });
}
