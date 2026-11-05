import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const PREFIX = "antaqor-live-";
export function broadcastService() {
  const key = process.env.ANTAQOR_LIVE_API_KEY;
  const secret = process.env.ANTAQOR_LIVE_API_SECRET;
  if (!key || !secret) throw new Error("Broadcast service is not configured");
  return new RoomServiceClient("http://127.0.0.1:7880", key, secret, { requestTimeout: 5 });
}
export function isBroadcastRoom(name: unknown): name is string {
  return typeof name === "string" && /^antaqor-live-[a-f0-9-]{36}$/.test(name);
}
export async function broadcastRooms() {
  return (await broadcastService().listRooms()).filter(r => r.name.startsWith(PREFIX));
}
export async function broadcastStatus() {
  const rooms = await broadcastRooms();
  for (const room of rooms) {
    const participants = await broadcastService().listParticipants(room.name);
    const host = participants.find(p => p.identity === "host");
    // A scheduled room or a disconnected host must never be labelled LIVE.
    if (!host?.tracks.some(t => t.type === 1 && !t.muted)) continue;
    let title = "Бодит ажлыг live-аар үзүүл.";
    let startedAt: string | null = null;
    try { const m = JSON.parse(room.metadata); title = m.title || title; startedAt = m.startedAt || null; } catch {}
    return { live: true, room: room.name, title, startedAt, viewers: participants.filter(p => p.identity !== "host" && p.state === 2).length };
  }
  return { live: false, room: null, title: "Бодит ажлыг live-аар үзүүл.", startedAt: null, viewers: 0 };
}
/* Identity нь ЧАТЫН ЭРХИЙГ тодорхойлно (2026-10-09):
   • "host"            — хөтлөгч
   • "u-<userId>-xxxx" — нэвтэрсэн гишүүн → чат бичнэ (нэр нь серверээс, хуурамчлах боломжгүй)
   • "guest-<uuid>"    — зочин → reaction л; чатыг нь хүлээн авагч бүр үл тооно.
   Дотор нь санамсаргүй дагавар: нэг хүн хоёр таб нээвэл LiveKit давхар
   identity-г хөөдөг тул. */
export async function broadcastToken(room: string, host: boolean, viewer?: { id?: string; name?: string }) {
  const identity = host
    ? "host"
    : viewer?.id
      ? `u-${viewer.id}-${crypto.randomUUID().slice(0, 4)}`
      : `guest-${crypto.randomUUID()}`;
  const name = host ? "Antaqor" : (viewer?.name || "Зочин").slice(0, 40);
  const token = new AccessToken(process.env.ANTAQOR_LIVE_API_KEY, process.env.ANTAQOR_LIVE_API_SECRET, { identity, name, ttl: "10m" });
  token.addGrant({ roomJoin: true, room, canSubscribe: true, canPublish: host, canPublishData: true });
  return { token: await token.toJwt(), serverUrl: "wss://antaqor.com/livekit", room, identity, canChat: host || !!viewer?.id };
}
