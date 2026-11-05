import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Ресторан — Scout агентын ЦОРЫН ГАНЦ өгөгдлийн эх сурвалж ──────────────
   Агентын оюун ухаан LLM-ээс биш, ЭНЭ коллекцоос гарна. Загвар (model) бол
   солигдож болох эд анги — өнөөдөр Grok, маргааш GPT. Харин энэ хүснэгтэд
   байгаа үнэ, цэс, цагийн хуваарь бол хуулж авах боломжгүй хөрөнгө.

   ЯАГААД `verified` талбар БҮТЦИЙН хэсэг вэ: ресторанны үнэ сар болгон
   өөрчлөгддөг. Баталгаажаагүй үнийг баталгаатай мэт харуулах нь хэрэглэгчийг
   буруу газар илгээнэ — тэр бол зүгээр нэг алдаа биш, итгэл алдах явдал.
   Тиймээс агент ба UI хоёул `verified: false` мөрийг ИЛ тэмдэглэдэг. Админ
   тухайн газарт очиж/залгаж шалгаад л `verified: true` болгоно.           */

export interface IMenuItem {
  name: string;        // "Samgyeopsal"
  nameMn?: string;     // "Самгёпсаль"
  price: number;       // ₮
  category?: string;   // bbq | soup | rice | noodle | side | drink
  servesPeople?: number; // 1 хүнд? 2 хүнд? (BBQ ихэвчлэн 2)
  spicy?: boolean;
}

export interface IRestaurant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  nameMn?: string;
  slug: string;
  district: string;          // канон: Khan-Uul | Sukhbaatar | Bayanzurkh | Chingeltei | Bayangol | Songinokhairkhan | Nalaikh | Unknown
  /* Дүүрэг бол хэтэрхий бүдүүн нэгж — Хан-Уул гэдэгт Зайсан ба 120-мянгат
     хоёулаа багтана. Хүн бодит амьдрал дээр "Зайсан ойрхон" гэж боддог.
     `area` нь тэр нарийн түвшин; `lat/lng` нь газрын зураг руу шууд заана. */
  area?: string;             // "Зайсан", "Сансар", "Их сургуулийн гудамж"
  lat?: number;
  lng?: number;
  address?: string;
  cuisine: string[];         // ["Korean","BBQ"]
  tags: string[];            // ["charcoal","late-night","family"]
  pricePerPerson: number;    // нэг хүний дундаж зарцуулалт ₮
  parking: boolean;
  soloFriendly: boolean;     // ганцаараа суухад эвгүй биш үү
  delivery: boolean;
  reservation: boolean;
  hours: { open: string; close: string }; // "11:00" / "23:00" (24:00-аас хойш бол "02:00")
  menu: IMenuItem[];
  phone?: string;
  mapUrl?: string;
  link?: string;
  rating?: number;           // 0-5
  note?: string;             // агентад өгөх нэг мөр контекст
  verified: boolean;
  lastVerified: Date | null;
  source?: string;           // хаанаас авсан — "tripadvisor" | "visit" | "call"
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    nameMn: { type: String, trim: true, maxlength: 80 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, maxlength: 24 },
    servesPeople: { type: Number, min: 1, max: 10 },
    spicy: { type: Boolean, default: false },
  },
  { _id: false }
);

const RestaurantSchema = new Schema<IRestaurant>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    nameMn: { type: String, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    district: { type: String, required: true, trim: true, index: true },
    area: { type: String, trim: true, maxlength: 60, index: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    address: { type: String, trim: true, maxlength: 240 },
    cuisine: { type: [String], default: ["Korean"], index: true },
    tags: { type: [String], default: [] },
    pricePerPerson: { type: Number, required: true, min: 0, index: true },
    parking: { type: Boolean, default: false },
    soloFriendly: { type: Boolean, default: true },
    delivery: { type: Boolean, default: false },
    reservation: { type: Boolean, default: false },
    hours: {
      open: { type: String, default: "11:00" },
      close: { type: String, default: "22:00" },
    },
    menu: { type: [MenuItemSchema], default: [] },
    phone: { type: String, trim: true, maxlength: 40 },
    mapUrl: { type: String, trim: true, maxlength: 500 },
    link: { type: String, trim: true, maxlength: 500 },
    rating: { type: Number, min: 0, max: 5 },
    note: { type: String, trim: true, maxlength: 400 },
    verified: { type: Boolean, default: false, index: true },
    lastVerified: { type: Date, default: null },
    source: { type: String, trim: true, maxlength: 60 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

const Restaurant: Model<IRestaurant> =
  mongoose.models.Restaurant ||
  mongoose.model<IRestaurant>("Restaurant", RestaurantSchema);

export default Restaurant;
