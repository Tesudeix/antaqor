import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import RentListing from "@/models/RentListing";
import RentBooking from "@/models/RentBooking";
import User from "@/models/User";
import type { Types } from "mongoose";

/* ─── /api/rent/bookings ───────────────────────────────────────────────
   POST — viewing цаг авах. Нэвтрэх ШААРДЛАГАГҮЙ: байр хайж буй хүн
   Antaqor-ийн гишүүн байх албагүй, тиймээс нэр + утас авч хангалттай.
   Нэвтэрсэн бол эзэмшигчийг нь холбоно.

   GET — өөрийн захиалгууд (нэвтэрсэн), эсвэл утсаар хайх. */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as {
    listing?: string; date?: string; dayLabel?: string; slot?: string;
    mode?: string; name?: string; phone?: string; note?: string;
  } | null;
  if (!b?.listing || !b.slot || !b.date) {
    return NextResponse.json({ error: "Байр, өдөр, цаг гурвыг сонгоно уу" }, { status: 400 });
  }
  const phone = String(b.phone || "").replace(/\D/g, "");
  if (phone.length < 6) {
    return NextResponse.json({ error: "Утасны дугаараа оруулна уу" }, { status: 400 });
  }

  await dbConnect();
  const listing = await RentListing.findById(b.listing).lean().catch(() => null);
  if (!listing) return NextResponse.json({ error: "Зар олдсонгүй" }, { status: 404 });

  const session = await getServerSession(authOptions);
  let userId: Types.ObjectId | undefined = undefined;
  if (session?.user?.email) {
    const u = await User.findOne({ email: session.user.email }).select("_id").lean();
    if (u) userId = (u as unknown as { _id: Types.ObjectId })._id;
  }

  const l = listing as unknown as { title: string; location: string };
  try {
    const row = await RentBooking.create({
      listing: b.listing,
      listingTitle: l.title,
      listingLocation: l.location,
      user: userId,
      name: String(b.name || "").slice(0, 80),
      phone: phone.slice(0, 24),
      dayLabel: String(b.dayLabel || "").slice(0, 40),
      date: new Date(b.date),
      slot: String(b.slot).slice(0, 10),
      mode: b.mode === "Видео" ? "Видео" : "Биеэр",
      note: String(b.note || "").slice(0, 400),
    });
    return NextResponse.json({ ok: true, id: String(row._id) });
  } catch (e) {
    /* Давхардсан түлхүүр = тэр цагийг хэн нэгэн сая авсан. Хуудас
       хуучин "завгүй" жагсаалттай байсан тул ойлгомжтой хэлнэ. */
    if ((e as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Энэ цагийг саяхан өөр хүн авчихлаа. Өөр цаг сонгоно уу.", code: "TAKEN" }, { status: 409 });
    }
    throw e;
  }
}

export async function GET(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);
  const phone = (req.nextUrl.searchParams.get("phone") || "").replace(/\D/g, "");

  const or: Record<string, unknown>[] = [];
  if (session?.user?.email) {
    const u = await User.findOne({ email: session.user.email }).select("_id").lean();
    if (u) or.push({ user: (u as unknown as { _id: Types.ObjectId })._id });
  }
  if (phone.length >= 6) or.push({ phone });
  if (!or.length) return NextResponse.json({ bookings: [] });

  const rows = await RentBooking.find({ $or: or }).sort({ date: 1 }).limit(50).lean();
  return NextResponse.json({
    bookings: rows.map((r) => ({
      id: String(r._id), title: r.listingTitle, location: r.listingLocation,
      day: r.dayLabel, slot: r.slot, mode: r.mode, status: r.status,
    })),
  });
}
