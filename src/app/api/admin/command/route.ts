import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { command, research, brief } from "@/lib/socialCommand";
import { refreshAll } from "@/lib/socialRefresh";

/* GET            — хяналтын төвийн бүх өгөгдөл
   GET ?q=        — судалгаа (өөрийн + өрсөлдөгчийн постоор хайх)
   POST {action:"refresh"}   — бүх сувгийг одоо татах (AI суралцахгүй, хурдан)
   POST {action:"brief",q}   — сэдвийн AI судалгааны тайлан */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  if (q) return NextResponse.json(await research(q));
  return NextResponse.json(await command(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "refresh") return NextResponse.json(await refreshAll());
    if (b.action === "brief") return NextResponse.json({ brief: await brief(String(b.q || "").slice(0, 80)) });
    return NextResponse.json({ error: "action" }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
