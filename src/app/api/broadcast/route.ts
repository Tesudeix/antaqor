import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { broadcastRooms, broadcastService, broadcastStatus, broadcastToken, isBroadcastRoom } from "@/lib/broadcast-server";
import { addLiveSchedule, getLiveSchedules, markScheduleRoom, removeLiveSchedule, removeScheduleByRoom } from "@/lib/broadcast-schedule";
export const dynamic = "force-dynamic";

/* 2026-10-09: ОЛОН товлолт (schedules) + нэвтэрсэн үзэгчид нэртэй токен
   (live чат). `schedule` = хамгийн ойрын нэг — хуучин клиентүүдтэй нийцнэ. */
async function readStatus() {
  const [status, schedules] = await Promise.all([broadcastStatus(), getLiveSchedules()]);
  return { ...status, schedule: schedules[0] ?? null, schedules };
}
let statusCache: { expires: number; value: Awaited<ReturnType<typeof readStatus>> } | undefined;
let pendingStatus: ReturnType<typeof readStatus> | undefined;
async function publicStatus() {
  if (statusCache && statusCache.expires > Date.now()) return statusCache.value;
  pendingStatus ??= readStatus().then(value => {
    statusCache = { value, expires: Date.now() + 2000 };
    return value;
  }).finally(() => { pendingStatus = undefined; });
  return pendingStatus;
}
export async function GET() {
  try { return NextResponse.json(await publicStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ live: false, viewers: 0, schedules: [], error: "Шууд дамжуулалтын холболт түр тасарлаа." }, { status: 503 }); }
}
export async function POST(req: NextRequest) {
  // Only the same-origin application can start, stop, or request access.
  if (req.headers.get("origin") && req.headers.get("origin") !== new URL(req.url).origin && req.headers.get("origin") !== "https://antaqor.com") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  try {
    const session = await getServerSession(authOptions);
    if (body.action === "watch") {
      const status = await broadcastStatus();
      if (!status.live || !status.room) return NextResponse.json({ error: "Шууд дамжуулалт эхлээгүй байна." }, { status: 409 });
      const user = session?.user as { id?: string; name?: string | null } | undefined;
      return NextResponse.json(await broadcastToken(status.room, false, user?.id ? { id: user.id, name: user.name || "Гишүүн" } : undefined));
    }
    if (!session?.user || !isAdmin(session.user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (body.action === "schedule") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      const startsAt = new Date(body.startsAt);
      if (!title || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now() || startsAt.getTime() > Date.now() + 366 * 86400000)
        return NextResponse.json({ error: "Гарчиг болон ирээдүйн өдөр, цагаа сонгоно уу." }, { status: 400 });
      await addLiveSchedule({ title, startsAt: startsAt.toISOString() });
      statusCache = undefined;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "cancelSchedule") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
      await removeLiveSchedule(body.id); statusCache = undefined;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "start") {
      const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
      if (!title) return NextResponse.json({ error: "Гарчиг оруулна уу." }, { status: 400 });
      // Reuse an unfinished studio session; the single host identity prevents double publishing.
      const existing = (await broadcastRooms())[0];
      const room = existing?.name || `antaqor-live-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ title, startedAt: new Date().toISOString() });
      if (existing) await broadcastService().updateRoomMetadata(room, metadata);
      else await broadcastService().createRoom({ name: room, metadata, emptyTimeout: 300, departureTimeout: 20, maxParticipants: 300 });
      await markScheduleRoom(title, room);
      statusCache = undefined;
      return NextResponse.json(await broadcastToken(room, true));
    }
    if (body.action === "stop" && isBroadcastRoom(body.room)) {
      const rooms = await broadcastRooms();
      if (rooms.some(r => r.name === body.room)) await broadcastService().deleteRoom(body.room);
      await removeScheduleByRoom(body.room);
      statusCache = undefined;
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Broadcast service:", error instanceof Error ? error.message : "unavailable");
    return NextResponse.json({ error: "Холболт амжилтгүй. Дахин оролдоно уу." }, { status: 503 });
  }
}
