import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function GET(req: Request) {
  try {
    await dbConnect();

    const now = new Date();

    // Auto-update statuses
    await Event.updateMany(
      { status: "upcoming", date: { $lte: now } },
      { $set: { status: "live" } }
    );
    await Event.updateMany(
      { status: "live", endDate: { $lte: now } },
      { $set: { status: "ended" } }
    );

    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month"); // "2026-04"
    const type = searchParams.get("type");

    const query: Record<string, unknown> = {};

    if (month) {
      const [y, m] = month.split("-").map(Number);
      query.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    } else {
      query.status = { $in: ["upcoming", "live"] };
    }

    if (type && type !== "all") {
      query.type = type;
    }

    const events = await Event.find(query)
      .sort({ date: 1 })
      .select("title description type date endDate liveLink location status color attendees image")
      .populate("createdBy", "name avatar")
      .lean();

    return NextResponse.json({
      events: events.map((e) => ({
        ...e,
        attendeeCount: Array.isArray(e.attendees) ? e.attendees.length : 0,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
