// GET /api/yuki/availability?stylist=ID&service=ID&date=YYYY-MM-DD
// Returns 30-min slot starts for a stylist on a given day, filtered by:
//  - the stylist's working hours for that day-of-week
//  - existing bookings (each slot must accommodate the full service duration
//    without overlapping any prior booking)
//  - past slots are excluded if `date === today`
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import YukiStylist from "@/models/YukiStylist";
import YukiService from "@/models/YukiService";
import YukiBooking from "@/models/YukiBooking";

const SLOT_STEP_MIN = 30;
const TZ_OFFSET_MIN = 8 * 60; // Mongolia (UTC+8) — switch when going global

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stylistId = searchParams.get("stylist");
    const serviceId = searchParams.get("service");
    const dateStr = searchParams.get("date"); // YYYY-MM-DD
    if (!stylistId || !serviceId || !dateStr) {
      return NextResponse.json({ error: "stylist, service, date required" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    await dbConnect();
    const [stylist, service] = await Promise.all([
      YukiStylist.findById(stylistId).lean(),
      YukiService.findById(serviceId).lean(),
    ]);
    if (!stylist) return NextResponse.json({ error: "Stylist not found" }, { status: 404 });
    if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

    // Day boundaries in Mongolia local time, expressed as UTC instants.
    const dayStartUtc = new Date(`${dateStr}T00:00:00Z`).getTime() - TZ_OFFSET_MIN * 60_000;
    const dayEndUtc = dayStartUtc + 24 * 60 * 60_000;
    const dow = new Date(dayStartUtc + TZ_OFFSET_MIN * 60_000).getUTCDay(); // local DOW
    const hours = stylist.weeklyHours?.[dow];
    if (!hours || hours.closed) {
      return NextResponse.json({ slots: [], reason: "closed" });
    }

    // Working window
    const [oH, oM] = hours.open.split(":").map(Number);
    const [cH, cM] = hours.close.split(":").map(Number);
    const winOpen = dayStartUtc + (oH * 60 + oM) * 60_000;
    const winClose = dayStartUtc + (cH * 60 + cM) * 60_000;

    // Existing bookings for this stylist on this day
    const existing = await YukiBooking.find({
      stylist: stylistId,
      status: { $in: ["pending", "confirmed"] },
      startsAt: { $lt: new Date(dayEndUtc) },
      endsAt: { $gt: new Date(dayStartUtc) },
    })
      .select("startsAt endsAt")
      .lean();

    // Step through the day and check each candidate start.
    const durationMs = service.durationMin * 60_000;
    const stepMs = SLOT_STEP_MIN * 60_000;
    const now = Date.now();
    const slots: string[] = [];
    for (let t = winOpen; t + durationMs <= winClose; t += stepMs) {
      if (t < now) continue;
      const slotStart = t;
      const slotEnd = t + durationMs;
      const overlaps = existing.some((b) => {
        const bs = new Date(b.startsAt).getTime();
        const be = new Date(b.endsAt).getTime();
        return slotStart < be && slotEnd > bs;
      });
      if (!overlaps) slots.push(new Date(slotStart).toISOString());
    }

    return NextResponse.json({
      slots,
      stylist: { _id: String(stylist._id), name: stylist.name },
      service: { _id: String(service._id), name: service.name, durationMin: service.durationMin },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load availability";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
