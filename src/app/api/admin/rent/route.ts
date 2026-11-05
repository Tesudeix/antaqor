import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import RentListing from "@/models/RentListing";
import RentBooking from "@/models/RentBooking";

/* /api/admin/rent — зарын CRUD + захиалгын жагсаалт. */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  if (req.nextUrl.searchParams.get("view") === "bookings") {
    const bookings = await RentBooking.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ bookings: bookings.map((b) => ({ ...b, _id: String(b._id), listing: String(b.listing) })) });
  }
  const listings = await RentListing.find({}).sort({ order: -1, createdAt: -1 }).lean();
  return NextResponse.json({ listings: listings.map((l) => ({ ...l, _id: String(l._id) })) });
}

type Body = Record<string, unknown>;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

function clean(b: Body) {
  const routes = Array.isArray(b.routes) ? b.routes : [];
  return {
    title: str(b.title, 120), price: num(b.price), location: str(b.location, 160),
    district: str(b.district, 40), area: num(b.area), rooms: num(b.rooms),
    baths: num(b.baths), floor: num(b.floor), badge: str(b.badge, 40),
    photo: str(b.photo, 300), desc: str(b.desc, 1200),
    hoa: num(b.hoa, 45000), orient: str(b.orient, 20) || "Өмнө",
    sunPeak: Math.min(23, Math.max(0, num(b.sunPeak, 13))),
    noise: num(b.noise, 48), road: str(b.road, 80),
    fee: num(b.fee), deposit: Math.max(0, num(b.deposit, 1)),
    /* ЯГ 4 чиглэл — хуудас DESTS-ийн дарааллаар индексээр уншина.
       Дутуу ирвэл тэг мөрөөр нөхнө, илүүг нь тасална. */
    routes: Array.from({ length: 4 }, (_, i) => {
      const r = (routes[i] || {}) as Body;
      return { km: num(r.km), off: num(r.off), peak: num(r.peak) };
    }),
    published: b.published !== false,
    order: num(b.order),
  };
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b.title || !b.price) return NextResponse.json({ error: "Гарчиг, үнэ шаардлагатай" }, { status: 400 });
  await dbConnect();
  const row = await RentListing.create(clean(b));
  return NextResponse.json({ ok: true, id: String(row._id) });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  if (!b._id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await dbConnect();
  const row = await RentListing.findByIdAndUpdate(String(b._id), clean(b), { new: true });
  if (!row) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  const booking = req.nextUrl.searchParams.get("booking");
  await dbConnect();
  if (booking) { await RentBooking.deleteOne({ _id: booking }); return NextResponse.json({ ok: true }); }
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  await RentListing.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
