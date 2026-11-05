import { randomBytes } from "crypto";
import KhuushuurItem from "@/models/KhuushuurItem";
import KhuushuurOrder from "@/models/KhuushuurOrder";

/* ТАЛ ХУУШУУР — /khuushuur дундын туслахууд (2026-10-17). */

/** Цэсний ангилал — дараалал нь хуудасны дараалал. Шинэ ангилал нэмэх бол ЭНД. */
export const KH_CATEGORIES = [
  { id: "khuushuur", name: "Хуушуур" },
  { id: "bagts", name: "Багц" },
  { id: "shol", name: "Шөл" },
  { id: "khachir", name: "Хачир" },
  { id: "undaa", name: "Ундаа" },
] as const;
export const KH_CATEGORY_IDS: string[] = KH_CATEGORIES.map((c) => c.id);

/** Зураггүй үед зурагдах SVG — src/components/khuushuur/KhArt.tsx */
export const KH_ARTS = ["one", "two", "stack", "combo", "combotea", "soup", "salad", "pickle", "tea", "airag", "cola", "water"];

/** Хүргэлтийн төлбөр ба үнэгүй болох босго. Өөрчлөх бол ЭНД л. */
export const KH_DELIVERY_FEE = 3000;
export const KH_FREE_OVER = 25000;
export function khDeliveryFee(mode: "delivery" | "pickup", subtotal: number): number {
  if (mode === "pickup" || subtotal <= 0 || subtotal >= KH_FREE_OVER) return 0;
  return KH_DELIVERY_FEE;
}

export type KhPublicItem = {
  _id: string; slug: string; category: string; name: string; kcal: string; description: string;
  price: number; image: string; art: string; tag: string; soldOut: boolean;
};

export function toPublicKh(x: Record<string, unknown>): KhPublicItem {
  return {
    _id: String(x._id), slug: String(x.slug), category: String(x.category), name: String(x.name),
    kcal: String(x.kcal || ""), description: String(x.description || ""), price: Number(x.price) || 0,
    image: String(x.image || ""), art: String(x.art || "one"), tag: String(x.tag || ""), soldOut: !!x.soldOut,
  };
}

/** KH-7K2M9QXD — төөрөгдүүлэх тэмдэгтгүй 8 тэмдэгт. */
export function newKhOrderNo(): string {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return "KH-" + Array.from(randomBytes(8), (v) => A[v % A.length]).join("");
}

/** pending → paid атомик. Wire-ийн буцалт, статусын асуулт уралдсан ч нэг л удаа. */
export async function markKhOrderPaid(orderNo: string): Promise<boolean> {
  const o = await KhuushuurOrder.findOneAndUpdate(
    { orderNo, status: "pending" },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true }
  );
  return !!o;
}

/* Анхны цэс — коллекц ХООСОН үед л нэг удаа орно. Админ бүгдийг
   устгавал дахин орохгүйн тулд `active:false` болгож нуух нь зөв. */
const SEED = [
  ["khuushuur", "kh-ukher", "Үхрийн махтай хуушуур", "412 ккал", "Үхрийн гуя, сонгино, хар перц, давс. 1 ширхэг, 150 гр.", 2800, "one", "Хамгийн их"],
  ["khuushuur", "kh-khoni", "Хонины махтай хуушуур", "468 ккал", "Хонины мах өөхтэй нь, сонгино, сармис. Уламжлалт жор.", 3000, "one", ""],
  ["khuushuur", "kh-kholimog", "Холимог махтай", "440 ккал", "Үхэр, хонины мах 50/50, сонгино, кмин.", 2900, "one", ""],
  ["khuushuur", "kh-tums", "Төмстэй хуушуур", "356 ккал", "Үхрийн мах, хэрчсэн төмс, сонгино.", 2500, "one", ""],
  ["khuushuur", "kh-byaslag", "Бяслагтай хуушуур", "498 ккал", "Үхрийн мах, хайлсан моцарелла, ногоон сонгино.", 3500, "one", "Шинэ"],
  ["khuushuur", "kh-nogoo", "Ногоотой хуушуур", "298 ккал", "Байцаа, лууван, мөөг, сонгино. Махгүй.", 2300, "one", ""],
  ["bagts", "bg-gants", "Ганцаарын багц", "1,060 ккал", "2ш үхрийн махтай хуушуур, 1 аяга сүүтэй цай.", 7500, "combotea", ""],
  ["bagts", "bg-shol", "Шөлтэй багц", "1,210 ккал", "2ш хуушуур, гурилтай шөл, даршилсан ногоо.", 9800, "combo", ""],
  ["bagts", "bg-geriin", "Гэр бүлийн багц", "4,300 ккал", "10ш холимог хуушуур, 2 салат, 1л ундаа.", 32000, "stack", "4–5 хүн"],
  ["bagts", "bg-naadam", "Наадмын багц", "8,800 ккал", "20ш хуушуур (үхэр, хонь), 4 салат, 2л айраг.", 62000, "stack", "Наадам"],
  ["shol", "sh-guril", "Гурилтай шөл", "520 ккал", "Гар гурил, үхрийн мах, төмс, лууван.", 6500, "soup", ""],
  ["shol", "sh-bansh", "Банштай шөл", "480 ккал", "8ш жижиг банш, махан шөл, ногоон сонгино.", 7000, "soup", ""],
  ["khachir", "kc-niislel", "Нийслэл салат", "310 ккал", "Төмс, лууван, өндөг, хиам, вандуй, майонез.", 3500, "salad", ""],
  ["khachir", "kc-luuvan", "Луувангийн салат", "140 ккал", "Сармистай, халуун ногоотой солонгос лууван.", 2500, "salad", ""],
  ["khachir", "kc-khemkh", "Даршилсан өргөст хэмх", "40 ккал", "Гэрийн даршилгаа, дилл.", 2000, "pickle", ""],
  ["undaa", "un-tsai", "Сүүтэй цай", "90 ккал", "Ногоон цай, сүү, давс. 350 мл.", 1500, "tea", ""],
  ["undaa", "un-airag", "Айраг", "110 ккал", "Гүүний айраг. 500 мл.", 4500, "airag", "Улирлын"],
  ["undaa", "un-cola", "Кока-Кола", "210 ккал", "0.5 л.", 2500, "cola", ""],
  ["undaa", "un-us", "Ус", "0 ккал", "0.5 л.", 1200, "water", ""],
] as const;

export async function ensureKhSeed(): Promise<void> {
  if (await KhuushuurItem.estimatedDocumentCount()) return;
  const n = SEED.length;
  await KhuushuurItem.insertMany(
    SEED.map(([category, slug, name, kcal, description, price, art, tag], i) => ({
      category, slug, name, kcal, description, price, art, tag, sort: n - i,
    })),
    { ordered: false }
  ).catch(() => { /* зэрэг ирсэн хоёр хүсэлт — unique slug давхардлыг хаана */ });
}
