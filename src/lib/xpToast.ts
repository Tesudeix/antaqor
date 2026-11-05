/* ─── XP-ийн дохио — Antaqor-ийн гарын үсэг ─────────────────────────────
   `LEARN → BUILD → SHARE → WIN → LEVEL UP` гэсэн гогцоо нь профайл дээр
   зогсонги тоо байвал механик биш, чимэглэл. Хүн юм бүтээсэн ЯГ ТЭР мөчид
   өсөлтөө харах ёстой — тэгж байж дараагийн удаа юу хийхээ мэднэ.

   Яагаад цонхны event вэ (React context биш): XP олгодог газрууд бүхэл
   аппаар тарсан байдаг — пост бичих цонх, хичээлийн хуудас, даалгаврын
   урсгал. Тэдгээрийг нэг provider-ийн доор цуглуулах гэвэл layout-аас
   доош хамаарал татах болно. Цонхны event нь чиглэлгүй: илгээгч нь
   хүлээн авагчийн тухай юу ч мэдэхгүй, хүлээн авагч байхгүй бол зүгээр
   л юу ч болохгүй. */

export const XP_EVENT = "antaqor:xp";

export type XPEventDetail = {
  /** Энэ үйлдлээр олгогдсон XP. 0 бол дохио илгээхгүй. */
  amount: number;
  /** Юуны төлөө — `BUILD`, `SHARE`, `LESSON`. Богино, машины хэлээр. */
  label?: string;
  /** Түвшин ахисан эсэх — тийм бол toast өөр хэлбэртэй гарна. */
  leveledUp?: boolean;
  /** Шинэ түвшин (leveledUp үед л утгатай). */
  level?: number;
};

export function emitXP(detail: XPEventDetail) {
  if (typeof window === "undefined") return;
  if (!detail || !detail.amount || detail.amount <= 0) return;
  window.dispatchEvent(new CustomEvent<XPEventDetail>(XP_EVENT, { detail }));
}

/** Серверийн хариунаас XP хэсгийг аваад дохио илгээнэ. Дуудагч бүр
 *  ижил хэлбэрийг дахин бичихээс сэргийлнэ. */
export function emitXPFromResponse(data: unknown, label: string) {
  const xp = (data as { xp?: { awarded?: number; leveledUp?: boolean; level?: number } })?.xp;
  if (!xp?.awarded) return;
  emitXP({ amount: xp.awarded, label, leveledUp: xp.leveledUp, level: xp.level });
}
