import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = await params;
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    const event = await Event.findById(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const attendeeIds = event.attendees.map((a) => String(a));
    const alreadyJoined = attendeeIds.includes(userId);

    if (alreadyJoined) {
      event.attendees = event.attendees.filter((a) => String(a) !== userId) as typeof event.attendees;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event.attendees.push(userId as any);
    }

    await event.save();

    return NextResponse.json({
      joined: !alreadyJoined,
      attendeesCount: event.attendees.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to join event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
