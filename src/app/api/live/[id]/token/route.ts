import { NextResponse } from "next/server";

// LiveKit integration paused — heavy native deps were hanging webpack on
// this 1.9GB droplet. Stub returns 501; viewer flow falls back to the
// YouTube/Twitch/HLS embed in the live page until LiveKit is re-enabled.
export async function POST() {
  return NextResponse.json({ error: "Live SFU temporarily disabled" }, { status: 501 });
}
