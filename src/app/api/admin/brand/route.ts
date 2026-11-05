import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getBrand, normalizeBrand, recolorIcons, saveBrand, uploadCover, uploadIcon, brandUrl, type Brand } from "@/lib/siteBrand";

/* Брэнд · SEO (/admin/brand) — GET: одоогийн утга, PUT: текст/өнгө, POST: icon эсвэл cover зураг. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

const view = (b: Brand) => ({
  brand: b,
  urls: {
    icon32: brandUrl(b, "icon-32.png"),
    icon192: brandUrl(b, "icon-192.png"),
    icon512: brandUrl(b, "icon-512.png"),
    apple: brandUrl(b, "apple-touch-icon.png"),
    maskable: brandUrl(b, "maskable-192.png"),
    cover: brandUrl(b, "cover"),
  },
});

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(view(await getBrand()));
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Буруу өгөгдөл" }, { status: 400 });
  const cur = await getBrand();
  /* icon/cover хувилбарыг клиент өөрчилж чадахгүй — зөвхөн upload-оор */
  let next = normalizeBrand({ ...cur, ...body, iconV: cur.iconV, ogV: cur.ogV });
  if (next.iconBg !== cur.iconBg && cur.iconV) next = await recolorIcons(next);
  return NextResponse.json(view(await saveBrand(next)));
}

export async function POST(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const kind = String(form?.get("kind") || "");
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Зураг сонгоно уу" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Зөвхөн зураг (PNG, JPG, WEBP)" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Зураг 10MB-аас бага байх ёстой" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (kind === "icon") return NextResponse.json(view(await uploadIcon(buf)));
    if (kind === "cover") return NextResponse.json(view(await uploadCover(buf)));
    return NextResponse.json({ error: "Төрөл буруу" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Зураг боловсруулж чадсангүй" }, { status: 400 });
  }
}

/* Анхдагч руу буцаах — ?what=icon|cover */
export async function DELETE(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const what = req.nextUrl.searchParams.get("what");
  const cur = await getBrand();
  if (what === "icon") return NextResponse.json(view(await saveBrand({ ...cur, iconV: "" })));
  if (what === "cover") return NextResponse.json(view(await saveBrand({ ...cur, ogV: "" })));
  return NextResponse.json({ error: "what=icon|cover" }, { status: 400 });
}
