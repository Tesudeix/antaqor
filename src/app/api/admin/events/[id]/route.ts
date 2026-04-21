import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    await dbConnect();

    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = body.title.trim();
    if (body.description !== undefined) update.description = body.description.trim();
    if (body.image !== undefined) update.image = body.image.trim();
    if (body.date !== undefined) update.date = new Date(body.date);
    if (body.endDate !== undefined) update.endDate = new Date(body.endDate);
    if (body.liveLink !== undefined) update.liveLink = body.liveLink.trim();
    if (body.location !== undefined) update.location = body.location.trim();
    if (body.status !== undefined) update.status = body.status;
    if (body.type !== undefined) update.type = body.type;
    if (body.color !== undefined) update.color = body.color;
    if (body.recurring !== undefined) update.recurring = body.recurring;

    const event = await Event.findByIdAndUpdate(id, update, { new: true });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await dbConnect();

    const event = await Event.findByIdAndDelete(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Event deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
