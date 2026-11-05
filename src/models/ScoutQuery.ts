import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Асуулт бүрийн бүртгэл ────────────────────────────────────────────────
   Энэ бол системийн хамгийн үнэ цэнтэй хөрөнгө. Ресторануудын үнэ бол
   бусад хүн ч цуглуулж чадах өгөгдөл; харин "Улаанбаатарын хүн солонгос
   хоол хайхдаа ЯГ ЮУ гэж асуудаг вэ" гэдгийг зөвхөн бид мэднэ.

   Хоёр зорилготой:
   1. Админд ЮУ НЭМЭХ ЭЭ хэлнэ — "0 үр дүнтэй" асуултууд нь сангийн нүх
      яг хаана байгааг заана (жишээ нь Баянзүрхэд газар алга гэдгийг).
   2. Хэрэглэгчийн хувийн ойг тэжээнэ.

   180 хоногийн TTL: мэдэгдэл 37 мянган мөр болж хавдаж байсан сургамжийг
   давтахгүй. Хураангуй статистик нь мөр өөрөө устсан ч /admin/scout дээр
   үлдэнэ.                                                                */

export interface IScoutQuery extends Document {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  question: string;
  reply: string;
  toolsUsed: string[];
  resultCount: number;    // 0 = сан хоосон буцаасан → нүх
  provider: string;
  ms: number;
  createdAt: Date;
}

const ScoutQuerySchema = new Schema<IScoutQuery>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    question: { type: String, required: true, maxlength: 700 },
    reply: { type: String, default: "", maxlength: 2000 },
    toolsUsed: { type: [String], default: [] },
    resultCount: { type: Number, default: 0, index: true },
    provider: { type: String, default: "" },
    ms: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ScoutQuerySchema.index({ createdAt: -1 });
ScoutQuerySchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const ScoutQuery: Model<IScoutQuery> =
  mongoose.models.ScoutQuery ||
  mongoose.model<IScoutQuery>("ScoutQuery", ScoutQuerySchema);

export default ScoutQuery;
