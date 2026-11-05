import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── PERSONAL BRAND-ЫН ЦӨМ (ганц бичлэг) ───────────────────────────────
   Байр суурь ба үнэт зүйлс нь код дотор ХАТУУ БИЧИГДЭХГҮЙ. Шалтгаан:
   брэнд нь өөрчлөгддөг (үнэт зүйлсийн нэг нь шууд "Evolving" гэж байгаа),
   харин код засахын тулд build хийх шаардлагатай. Эзэн нь дэлгэцээс
   засаад, дараагийн пост шууд шинэ тодорхойлолтоор бичигдэнэ.

   Хоёр газар уншина — давталт шинэ пост бичихдээ, ноорог дүгнэхдээ.
   Нэг эх сурвалж байх нь тэр хоёрыг зөрөхөөс сэргийлнэ. */

export interface BrandValue {
  name: string;
  /** Постод хэрхэн илрэх ёстойг ҮЙЛДЛЭЭР тайлбарлана. "Зоригтой бай"
   *  гэх ерөнхий үг AI-д юу ч хэлэхгүй — "өчигдрийн байр сууриа засаж
   *  чаддаг" гэдэг нь бичих заавар болно. */
  meaning: string;
}

export interface IBrandProfile extends Document {
  positioning: string;
  tagline: string;
  audience: string;
  values: BrandValue[];
  avoid: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandValueSchema = new Schema<BrandValue>({
  name: { type: String, required: true },
  meaning: { type: String, default: "" },
}, { _id: false });

const BrandProfileSchema = new Schema<IBrandProfile>({
  positioning: { type: String, default: "" },
  tagline: { type: String, default: "" },
  audience: { type: String, default: "" },
  values: { type: [BrandValueSchema], default: [] },
  avoid: { type: [String], default: [] },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

const BrandProfile: Model<IBrandProfile> =
  mongoose.models.BrandProfile || mongoose.model<IBrandProfile>("BrandProfile", BrandProfileSchema);

export default BrandProfile;
