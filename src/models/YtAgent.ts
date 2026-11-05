import mongoose, { Schema, Document, Model, Types } from "mongoose";

/* ─── ХЭРЭГЛЭГЧ ТУС БҮРИЙН AGENT ────────────────────────────────────────
   Хэрэглэгч бүр ӨӨРИЙН машин дээр agent ажиллуулна. Энэ бол тэр хоёрыг
   холбох бичлэг.

   Яагаад ингэж байгуулсан: antaqor.com-ын сервер YouTube-ээс татаж
   чадахгүй (droplet-ийн IP блоклогдсон, медиа хаяг нь уншсан IP-д
   хүлэгддэг). Харин хэрэглэгч бүрийн гэрийн IP хэвийн ажилладаг тул
   татацыг тэдний машинд гүйцэтгүүлэх нь прокси худалдах шаардлагыг
   бүхэлдээ таслана.

   НУУЦЫГ ТҮҮХИЙГЭЭР ХАДГАЛАХГҮЙ — зөвхөн sha256. Нэг л удаа харуулж,
   дараа нь дахин үүсгэхээс өөр арга байхгүй болгоно. */

export interface IYtAgent extends Document {
  user: Types.ObjectId;
  tokenHash: string;
  lastSeen?: Date;
  version: string;
  outDir: string;
  createdAt: Date;
  updatedAt: Date;
}

const YtAgentSchema = new Schema<IYtAgent>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  /* sha256 hex. Унших нь хайлтын түлхүүр тул индекстэй. */
  tokenHash: { type: String, required: true, unique: true, index: true },
  lastSeen: { type: Date },
  version: { type: String, default: "" },
  outDir: { type: String, default: "" },
}, { timestamps: true });

const YtAgent: Model<IYtAgent> =
  mongoose.models.YtAgent || mongoose.model<IYtAgent>("YtAgent", YtAgentSchema);

export default YtAgent;
