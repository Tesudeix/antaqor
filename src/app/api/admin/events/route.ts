import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();
    const events = await Event.find()
      .sort({ date: -1 })
      .populate("createdBy", "name")
      .populate("attendees", "name email")
      .lean();

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { title, description, image, date, endDate, liveLink, location, status } = await req.json();

    if (!title || !date) {
      return NextResponse.json({ error: "Title and date are required" }, { status: 400 });
    }

    await dbConnect();

    const userId = (session.user as { id: string }).id;

    const event = await Event.create({
      title: title.trim(),
      description: description?.trim() || "",
      image: image?.trim() || "",
      date: new Date(date),
      endDate: endDate ? new Date(endDate) : new Date(new Date(date).getTime() + 2 * 60 * 60 * 1000),
      liveLink: liveLink?.trim() || "",
      location: location?.trim() || "",
      status: status || "upcoming",
      createdBy: userId,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
