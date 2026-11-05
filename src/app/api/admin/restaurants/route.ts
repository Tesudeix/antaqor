import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Restaurant from "@/models/Restaurant";
import { normalizeDistrict } from "@/lib/scoutTools";

export const dynamic = "force-dynamic";

/* ─── /api/admin/restaurants — Scout агентын өгөгдлийн эх ─────────────────
   Агентын үнэ цэн загвараас биш, ЭНД оруулсан мөрүүдээс гарна. Тиймээс энэ
   бол админы хамгийн чухал хуудсуудын нэг: цэсний үнэ сар болгон өөрчлөгдөх
   бөгөөд шинэчлээгүй сан бол хуучирсан агент.                            */

async function gate() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

interface MenuIn { name?: unknown; nameMn?: unknown; price?: unknown; category?: unknown; servesPeople?: unknown; spicy?: unknown }

function cleanMenu(raw: unknown): { name: string; nameMn?: string; price: number; category?: string; servesPeople?: number; spicy?: boolean }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => m as MenuIn)
    .filter((m) => typeof m.name === "string" && String(m.name).trim())
    .map((m) => ({
      name: String(m.name).trim().slice(0, 80),
      nameMn: typeof m.nameMn === "string" && m.nameMn.trim() ? String(m.nameMn).trim().slice(0, 80) : undefined,
      price: Math.max(0, Math.round(Number(m.price) || 0)),
      category: typeof m.category === "string" && m.category.trim() ? String(m.category).trim().slice(0, 24) : undefined,
      servesPeople: Number(m.servesPeople) > 0 ? Math.min(10, Math.round(Number(m.servesPeople))) : undefined,
      spicy: m.spicy === true,
    }))
    .slice(0, 60);
}

/** Body → schema талбарууд. Зөвхөн ирсэн талбарыг л хөндөнө (PATCH-д чухал). */
function shape(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const s = (k: string, max: number) => {
    if (typeof body[k] === "string") out[k] = String(body[k]).trim().slice(0, max);
  };
  const b = (k: string) => { if (typeof body[k] === "boolean") out[k] = body[k]; };

  s("name", 120); s("nameMn", 120); s("address", 240); s("phone", 40);
  s("area", 60);
  s("mapUrl", 500); s("link", 500); s("note", 400); s("source", 60);

  if (typeof body.district === "string") {
    out.district = normalizeDistrict(body.district) || String(body.district).trim().slice(0, 60);
  }
  if (body.pricePerPerson !== undefined) {
    out.pricePerPerson = Math.max(0, Math.round(Number(body.pricePerPerson) || 0));
  }
  /* Координат: 0 нь Гвинейн булан — Улаанбаатарын хувьд 0 бол "оруулаагүй"
     гэсэн үг. Хоосон утгыг 0 болгож хадгалбал газрын зураг далайн дунд
     заана, тиймээс хоосныг УСТГАНА. */
  for (const k of ["lat", "lng"] as const) {
    if (body[k] === "" || body[k] === null) out[k] = undefined;
    else if (body[k] !== undefined) {
      const n = Number(body[k]);
      if (Number.isFinite(n) && n !== 0) out[k] = n;
    }
  }
  if (body.rating !== undefined && body.rating !== null && body.rating !== "") {
    out.rating = Math.min(5, Math.max(0, Number(body.rating) || 0));
  }
  for (const k of ["parking", "soloFriendly", "delivery", "reservation", "active"]) b(k);

  if (Array.isArray(body.cuisine)) out.cuisine = (body.cuisine as unknown[]).map(String).slice(0, 8);
  if (Array.isArray(body.tags)) out.tags = (body.tags as unknown[]).map(String).slice(0, 12);
  if (body.hours && typeof body.hours === "object") {
    const h = body.hours as { open?: unknown; close?: unknown };
    out.hours = { open: String(h.open || "11:00").slice(0, 5), close: String(h.close || "22:00").slice(0, 5) };
  }
  if (body.menu !== undefined) out.menu = cleanMenu(body.menu);

  /* `verified` нь ГАРААР л асна. Мөр засварлах болгонд автоматаар
     баталгаажсан болвол тэмдэг утгаа алдана — "би энэ үнийг өөрөө
     шалгасан" гэдэг л түүний цорын ганц утга.  */
  if (typeof body.verified === "boolean") {
    out.verified = body.verified;
    out.lastVerified = body.verified ? new Date() : null;
  }

  if (!partial) {
    out.cuisine = out.cuisine || ["Korean"];
    out.hours = out.hours || { open: "11:00", close: "22:00" };
  }
  return out;
}

export async function GET(req: NextRequest) {
  const block = await gate();
  if (block) return block;
  await dbConnect();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const filter = q
    ? { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }
    : {};
  const rows = await Restaurant.find(filter).sort({ verified: 1, name: 1 }).limit(300).lean();
  const verified = await Restaurant.countDocuments({ verified: true, active: true });
  return NextResponse.json({ restaurants: rows, verified, total: rows.length });
}

export async function POST(req: NextRequest) {
  const block = await gate();
  if (block) return block;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 });

  await dbConnect();
  const data = shape(body, false);
  let slug = typeof body.slug === "string" && body.slug.trim() ? slugify(String(body.slug)) : slugify(name);
  if (!slug) slug = `r-${Date.now()}`;
  // Нэр давхардвал slug-д дугаар нэмнэ — unique index унагахгүй.
  if (await Restaurant.exists({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const created = await Restaurant.create({ ...data, name, slug });
  return NextResponse.json({ restaurant: created });
}

export async function PATCH(req: NextRequest) {
  const block = await gate();
  if (block) return block;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await dbConnect();
  const r = await Restaurant.findByIdAndUpdate(id, shape(body, true), { new: true });
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ restaurant: r });
}

export async function DELETE(req: NextRequest) {
  const block = await gate();
  if (block) return block;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await dbConnect();
  await Restaurant.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
