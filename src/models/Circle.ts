import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ХҮРЭЭЛЭЛ ─────────────────────────────────────────────────────────
   Сайт доторх бие даасан бүлэг. Гишүүн нэгдэж, тэр хүрээлэлдээ пост
   бичнэ — пост нь `Post.circle` талбараар хамаарна.

   `/clan`-тай андуурахгүй: тэр нь зүгээр /pricing руу чиглүүлдэг
   хуучин зам, бүлгийн ойлголт биш. */

export interface ICircle extends Document {
  slug: string;
  name: string;
  tagline: string;
  desc: string;
  cover: string;
  /** Картын өнгөт зурвас. Харанхуй дээр уншигдах утга сонгоно. */
  accent: string;
  /** Бодит тоог `CircleMember`-ээс тоолно; энэ нь зөвхөн хурдан харуулах
   *  кэш — жагсаалт бүрт тоолох нь N нэмэлт query болно. */
  memberCount: number;
  published: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CircleSchema = new Schema<ICircle>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, maxlength: 60 },
    tagline: { type: String, default: "", maxlength: 120 },
    desc: { type: String, default: "", maxlength: 1000 },
    cover: { type: String, default: "" },
    accent: { type: String, default: "#2E29FF" },
    memberCount: { type: Number, default: 0 },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CircleSchema.index({ published: 1, order: -1 });

export default (mongoose.models.Circle as Model<ICircle>) ||
  mongoose.model<ICircle>("Circle", CircleSchema);
