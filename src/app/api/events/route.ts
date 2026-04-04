import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function GET() {
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

    const events = await Event.find({ status: { $in: ["upcoming", "live"] } })
      .sort({ date: 1 })
      .populate("createdBy", "name avatar")
      .lean();

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
