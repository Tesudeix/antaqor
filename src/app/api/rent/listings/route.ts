import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import User from "@/models/User";
import type { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import RentListing from "@/models/RentListing";
import RentBooking from "@/models/RentBooking";

/* GET /api/rent/listings — зар + аль цаг аль хэдийн захиалагдсан.
   Нэвтрэх шаардлагагүй: зар үзэх нь витрин. */
export async function GET() {
  await dbConnect();
  const rows = await RentListing.find({ published: true }).sort({ order: -1, createdAt: -1 }).lean();

  /* Ойрын 14 хоногийн завгүй цагууд — хуудас дээр "боломжгүй" гэж
     зурахад хэрэгтэй. Прототип үүнийг ['10:00','16:00'] гэж ХАТУУ
     бичсэн байсан. */
  const from = new Date(); from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 14 * 86400000);
  const busy = await RentBooking.find({
    date: { $gte: from, $lte: to },
    status: { $in: ["pending", "confirmed"] },
  }).select("listing date slot").lean();

  return NextResponse.json({
    listings: rows.map((l) => ({
      id: String(l._id),
      title: l.title, price: l.price, location: l.location, district: l.district,
      area: l.area, rooms: l.rooms, baths: l.baths, floor: l.floor,
      badge: l.badge, photo: l.photo, desc: l.desc,
      hoa: l.hoa, orient: l.orient, sunPeak: l.sunPeak, noise: l.noise,
      road: l.road, fee: l.fee, deposit: l.deposit,
      routes: (l.routes || []).map((r) => [r.km, r.off, r.peak]),
    })),
    busy: busy.map((b) => ({
      listing: String(b.listing),
      date: b.date ? new Date(b.date).toISOString().slice(0, 10) : "",
      slot: b.slot,
    })),
  });
}

/* ─── POST /api/rent/listings — ГИШҮҮН өөрөө зар тавина ───────────────
   Админ байх ШААРДЛАГАГҮЙ: энэ нь зах зээл, эзэн нь дангаараа бүх
   байрыг оруулахгүй. Нэвтэрсэн Antaqor хэрэглэгч шууд нийтэлнэ.

   ХЯЗГААР: өдөрт 5. Үүнгүй бол нэг данс мянган зар цацаад тэжээлийг
   дүүргэх боломжтой — "шууд нийтлэх"-ийг хадгалаад, хэмжээг нь л
   барина. Зар бүр `owner`-тэй тул админ хэн тавьсныг хардаг. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Нэвтэрч байж зар тавина" }, { status: 401 });
  }
  await dbConnect();
  const me = await User.findOne({ email: session.user.email }).select("_id name username").lean();
  if (!me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  const u = me as unknown as { _id: Types.ObjectId; name?: string; username?: string };

  const gate = rateLimit(`rent:post:${String(u._id)}`, { max: 5, windowMs: 24 * 60 * 60_000 });
  if (!gate.ok) {
    return NextResponse.json(
      { error: "Өдөрт 5 зар тавих боломжтой. Маргааш дахин оролдоно уу." },
      { status: 429 }
    );
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

  const title = str(b.title, 120);
  const price = num(b.price);
  if (!title || price <= 0) {
    return NextResponse.json({ error: "Гарчиг, үнэ шаардлагатай" }, { status: 400 });
  }

  /* Симуляцын үзүүлэлтийг гишүүнээс АСУУХГҮЙ — зам, нар, чимээг
     мэдэхгүй хүнээс гуйвал зар тавих нь ачаа болно. Боломжийн
     анхдагчаар эхэлж, админ /admin/rent-ээс нарийвчилна. */
  const row = await RentListing.create({
    title, price,
    location: str(b.location, 160),
    district: str(b.district, 40),
    area: num(b.area), rooms: num(b.rooms), baths: num(b.baths), floor: num(b.floor),
    badge: str(b.badge, 40), photo: str(b.photo, 300), desc: str(b.desc, 1200),
    hoa: num(b.hoa, 45000), orient: "Өмнө", sunPeak: 13, noise: 48,
    road: "", fee: 0, deposit: 1,
    routes: Array.from({ length: 4 }, () => ({ km: 5, off: 14, peak: 30 })),
    owner: u._id,
    ownerName: u.name || u.username || "",
    contactPhone: str(b.contactPhone, 24),
    published: true,
    order: 0,
  });

  console.log(`[rent] listing ${row._id} · ${title} · by=${session.user.email}`);
  return NextResponse.json({ ok: true, id: String(row._id) });
}

export const dynamic = "force-dynamic";
