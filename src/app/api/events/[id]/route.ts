import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();

    const now = new Date();
    // Auto-status nudge so the live page reflects truth without an admin click.
    await Event.updateOne(
      { _id: id, status: "upcoming", date: { $lte: now } },
      { $set: { status: "live" } }
    );
    await Event.updateOne(
      { _id: id, status: "live", endDate: { $lte: now } },
      { $set: { status: "ended" } }
    );

    const ev = await Event.findById(id)
      .select("title description type date endDate liveLink liveStreamUrl liveProvider viewerCount location status color attendees image")
      .lean<{ attendees?: unknown[]; [k: string]: unknown }>();
    if (!ev) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      event: {
        ...ev,
        attendeeCount: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
