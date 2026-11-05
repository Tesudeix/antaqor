import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ТҮРЭЭСИЙН ЗАР — /rent ────────────────────────────────────────────
   Прототипийн `LISTINGS` ба `SIM` хоёрыг НЭГ баримтад нийлүүлэв.
   Тэнд тусдаа байсан нь зөвхөн кодын хуваарилалт байсан бөгөөд
   бодит байдал дээр `SIM[id]` нь тухайн байрны шинж чанар — өөр
   хүснэгтэд тавих шалтгаан байхгүй, харин тусад нь тавибал зар
   нэмэх бүрд хоёр газар бичих шаардлага үүснэ. */

export interface IRentRoute {
  /** км, энгийн цагийн минут, оргил цагийн минут. */
  km: number;
  off: number;
  peak: number;
}

export interface IRentListing extends Document {
  title: string;
  /** Сарын түрээс ₮ — ТООГООР. Прототип "1,800,000" гэж мөрөөр
   *  хадгалаад тооцоолох бүрд задалдаг байсан; энд тоо хэвээр. */
  price: number;
  location: string;
  district: string;
  area: number;
  rooms: number;
  baths: number;
  floor: number;
  badge: string;
  photo: string;
  desc: string;

  /* ── Симуляцын үзүүлэлт ── */
  hoa: number;
  /** Цонхны чиг — нарны тооцоонд. */
  orient: string;
  /** Хамгийн гэрэлтэй цаг (0–23). */
  sunPeak: number;
  /** Суурь дуу чимээ, dB. */
  noise: number;
  road: string;
  /** Агентын шимтгэл — сарын түрээсийн хувь (0 эсвэл 0.5). */
  fee: number;
  /** Барьцаа — хэдэн сарын түрээс. */
  deposit: number;
  /** DESTS-ийн дарааллаар 4 чиглэл. */
  routes: IRentRoute[];

  /** Зар тавьсан гишүүн. Админ оруулсан бол хоосон. */
  owner?: mongoose.Types.ObjectId;
  ownerName: string;
  contactPhone: string;
  published: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const RouteSchema = new Schema<IRentRoute>(
  { km: { type: Number, default: 0 }, off: { type: Number, default: 0 }, peak: { type: Number, default: 0 } },
  { _id: false }
);

const RentListingSchema = new Schema<IRentListing>(
  {
    title: { type: String, required: true, maxlength: 120 },
    price: { type: Number, required: true },
    location: { type: String, default: "", maxlength: 160 },
    district: { type: String, default: "", index: true },
    area: { type: Number, default: 0 },
    rooms: { type: Number, default: 0 },
    baths: { type: Number, default: 0 },
    floor: { type: Number, default: 0 },
    badge: { type: String, default: "", maxlength: 40 },
    photo: { type: String, default: "" },
    desc: { type: String, default: "", maxlength: 1200 },

    hoa: { type: Number, default: 45000 },
    orient: { type: String, default: "Өмнө" },
    sunPeak: { type: Number, default: 13 },
    noise: { type: Number, default: 48 },
    road: { type: String, default: "" },
    fee: { type: Number, default: 0 },
    deposit: { type: Number, default: 1 },
    routes: { type: [RouteSchema], default: [] },

    owner: { type: Schema.Types.ObjectId, ref: "User", index: true },
    ownerName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RentListingSchema.index({ published: 1, order: -1, createdAt: -1 });

export default (mongoose.models.RentListing as Model<IRentListing>) ||
  mongoose.model<IRentListing>("RentListing", RentListingSchema);
