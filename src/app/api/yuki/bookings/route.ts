import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import YukiBooking from "@/models/YukiBooking";
import YukiService from "@/models/YukiService";
import YukiStylist from "@/models/YukiStylist";

// GET — current user's bookings (newest first).
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Auth required" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    await dbConnect();
    const bookings = await YukiBooking.find({ user: userId })
      .sort({ startsAt: -1 })
      .populate("service", "name durationMin priceMnt image")
      .populate("stylist", "name role avatar")
      .lean();
    return NextResponse.json({ bookings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load bookings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — create a booking. Re-checks slot availability inside a single read
// so we don't race against a concurrent booker; for stronger guarantees a
// unique index on (stylist, startsAt) would prevent any duplicate write at
// the DB level — add when traffic grows.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const body = await req.json();
    const serviceId = String(body.service || "");
    const stylistId = String(body.stylist || "");
    const locationId = String(body.location || "").trim();
    const startsAtRaw = String(body.startsAt || "");
    const customerName = String(body.customerName || (session.user.name || "")).trim().slice(0, 120);
    const contactPhone = String(body.contactPhone || "").trim().slice(0, 40);
    const notes = String(body.notes || "").trim().slice(0, 500);

    if (!serviceId || !stylistId || !startsAtRaw) {
      return NextResponse.json({ error: "service, stylist, startsAt шаардлагатай" }, { status: 400 });
    }
    const startsAt = new Date(startsAtRaw);
    if (isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "startsAt буруу" }, { status: 400 });
    }
    if (startsAt.getTime() < Date.now() - 5 * 60_000) {
      return NextResponse.json({ error: "Өнгөрсөн цаг сонгох боломжгүй" }, { status: 400 });
    }

    await dbConnect();
    const [service, stylist] = await Promise.all([
      YukiService.findById(serviceId).lean(),
      YukiStylist.findById(stylistId).lean(),
    ]);
    if (!service || !stylist) {
      return NextResponse.json({ error: "Үйлчилгээ эсвэл стилист олдсонгүй" }, { status: 404 });
    }

    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);

    // Conflict check — any active booking that overlaps this window?
    const conflict = await YukiBooking.findOne({
      stylist: stylistId,
      status: { $in: ["pending", "confirmed"] },
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    }).lean();
    if (conflict) {
      return NextResponse.json({ error: "Энэ цаг өөр захиалгад очсон. Шинэ цаг сонгоно уу." }, { status: 409 });
    }

    // Resolve location: explicit one from the form wins, then fall back to
    // the stylist's home branch. Mongoose's ObjectId field doesn't accept
    // null, so we only include the key when we actually have a value.
    const resolvedLocation = locationId || (stylist.location ? String(stylist.location) : "");
    const booking = await YukiBooking.create({
      user: userId,
      service: serviceId,
      stylist: stylistId,
      ...(resolvedLocation ? { location: resolvedLocation } : {}),
      startsAt,
      endsAt,
      durationMin: service.durationMin,
      priceMnt: service.priceMnt,
      status: "confirmed",
      customerName,
      contactPhone,
      notes,
    });

    // TODO: dispatch SMS + email confirmation via provider. For now we log so
    // the salon owner can wire Twilio / Resend later without touching the
    // booking write path.
    console.info("[yuki] booking confirmed", {
      id: String(booking._id),
      stylist: stylist.name,
      service: service.name,
      startsAt: startsAt.toISOString(),
      customerName,
      contactPhone,
    });

    return NextResponse.json(
      {
        booking: {
          _id: String(booking._id),
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          service: { _id: String(service._id), name: service.name, durationMin: service.durationMin, priceMnt: service.priceMnt },
          stylist: { _id: String(stylist._id), name: stylist.name, role: stylist.role, avatar: stylist.avatar },
          customerName,
          contactPhone,
          notes,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create booking";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
