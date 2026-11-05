import { randomUUID } from "crypto";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

/* ─── Live хуваарь — ОЛОН товлолт (2026-10-09) ────────────────────────────
   Өмнө нь ганц товлолт (`antaqor-live-schedule`) — нэгийг тавихад өмнөх нь
   дарагддаг байв. Одоо жагсаалт (`antaqor-live-schedules`), хамгийн ихдээ
   20. Хуучин ганц товлолт байвал анх уншихад жагсаалт руу шилжинэ.
   Өнгөрсөн (3 цагаас илүү) товлолт автоматаар шүүгдэнэ. */

const KEY = "antaqor-live-schedules";
const LEGACY_KEY = "antaqor-live-schedule";
const STALE_MS = 3 * 3600_000;

export type LiveSchedule = { id: string; title: string; startsAt: string; room?: string };

async function readRaw(): Promise<LiveSchedule[]> {
  await dbConnect();
  const [doc, legacy] = await Promise.all([
    SiteSettings.findOne({ key: KEY }).lean(),
    SiteSettings.findOne({ key: LEGACY_KEY }).lean(),
  ]);
  let list: LiveSchedule[] = [];
  try { list = doc?.value ? (JSON.parse(doc.value) as LiveSchedule[]) : []; } catch { list = []; }
  if (legacy?.value) {
    try {
      const one = JSON.parse(legacy.value) as Omit<LiveSchedule, "id">;
      if (one?.title && one?.startsAt) list.push({ id: randomUUID(), ...one });
    } catch { /* эвдэрсэн хуучин мөр — алгасна */ }
    await save(list);
  }
  return Array.isArray(list) ? list : [];
}

async function save(list: LiveSchedule[]) {
  await dbConnect();
  await SiteSettings.findOneAndUpdate({ key: KEY }, { value: JSON.stringify(list.slice(0, 20)) }, { upsert: true });
  await SiteSettings.deleteOne({ key: LEGACY_KEY });
}

/** Ирээдүйн (эсвэл саяхан эхэлсэн) товлолтууд, цагаар эрэмбэлсэн. */
export async function getLiveSchedules(): Promise<LiveSchedule[]> {
  const now = Date.now();
  return (await readRaw())
    .filter((s) => new Date(s.startsAt).getTime() > now - STALE_MS)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

/** Хамгийн ойрын товлолт — нүүрний тоолуурт. */
export async function getLiveSchedule(): Promise<LiveSchedule | null> {
  return (await getLiveSchedules())[0] ?? null;
}

export async function addLiveSchedule(input: { title: string; startsAt: string }) {
  const list = await getLiveSchedules();
  if (list.length >= 20) throw new Error("Хамгийн ихдээ 20 товлолт");
  list.push({ id: randomUUID(), title: input.title, startsAt: input.startsAt });
  await save(list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
}

export async function removeLiveSchedule(id: string) {
  await save((await getLiveSchedules()).filter((s) => s.id !== id));
}

/** Live эхлэхэд ижил гарчигтай товлолтод өрөөг тэмдэглэнэ. */
export async function markScheduleRoom(title: string, room: string) {
  const list = await getLiveSchedules();
  const hit = list.find((s) => s.title === title && !s.room);
  if (hit) { hit.room = room; await save(list); }
}

/** Live дуусахад тухайн өрөөтэй товлолтыг хасна. */
export async function removeScheduleByRoom(room: string) {
  const list = await getLiveSchedules();
  const next = list.filter((s) => s.room !== room);
  if (next.length !== list.length) await save(next);
}
