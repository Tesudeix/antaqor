import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Хэрэглэгч бүрийн Scout ой ─────────────────────────────────────────────
   Агент харьцах тусам ХУВИЙН болох ёстой. Тэр нь загварыг сургаж биш, ЭНЭ
   мөрийг тэжээж хийгдэнэ: хүн юу асуусан, ямар төсөвтэй, хаана байдаг, юуг
   нь татгалзсан — эдгээр нь дараагийн ярианы эхэнд системийн зааварт орно.

   Яагаад бүх түүхийг биш, ЗАДЛАСАН ТӨЛӨВИЙГ хадгалдаг вэ: 40 ээлжийн
   ярианы бүтэн текстийг prompt-д цутгах нь үнэтэй, удаан, бас загварыг
   сатаарна. Оронд нь ярианаас "энэ хүн Хан-Уул, 2 хүн, 35к орчим, халуун
   ногоо дуртай" гэсэн ХЭДХЭН мөр гаргаж авбал үүрд хадгалж болно.

   Хоосон талбар = "мэдэхгүй". Таамаглаж дүүргэхгүй — буруу профайл нь
   профайлгүйгээс дор, учир нь хүн яагаад буруу зөвлөгөө авч байгаагаа
   ойлгохгүй.                                                              */

export interface IScoutMemory extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;

  district: string;          // байнга хайдаг дүүрэг ("" = мэдэхгүй)
  area: string;              // нарийн байршил: "Зайсан", "Сансар"
  budgetPerPerson: number;   // 0 = мэдэхгүй
  partySize: number;         // 0 = мэдэхгүй

  likes: string[];           // "нүүрсэн грилл", "чимээгүй газар"
  dislikes: string[];        // "хэт халуун ногоотой"
  saved: mongoose.Types.ObjectId[];

  facts: string[];           // бусад тогтвортой баримт
  summary: string;           // 1-2 өгүүлбэрийн хураангуй

  totalQueries: number;
  lastAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ScoutMemorySchema = new Schema<IScoutMemory>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    district: { type: String, default: "", maxlength: 40 },
    area: { type: String, default: "", maxlength: 60 },
    budgetPerPerson: { type: Number, default: 0, min: 0 },
    partySize: { type: Number, default: 0, min: 0, max: 50 },
    likes: { type: [String], default: [] },
    dislikes: { type: [String], default: [] },
    saved: { type: [Schema.Types.ObjectId], ref: "Restaurant", default: [] },
    facts: { type: [String], default: [] },
    summary: { type: String, default: "", maxlength: 600 },
    totalQueries: { type: Number, default: 0 },
    lastAt: { type: Date },
  },
  { timestamps: true }
);

const ScoutMemory: Model<IScoutMemory> =
  mongoose.models.ScoutMemory ||
  mongoose.model<IScoutMemory>("ScoutMemory", ScoutMemorySchema);

export default ScoutMemory;
