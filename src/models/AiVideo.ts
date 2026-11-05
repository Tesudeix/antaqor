import mongoose, { Schema, Document, Model } from "mongoose";

// Нэг AI видео (`/tools/video` студи). ЗОРИУД `AiCreation`-оос ТУСДАА:
// тэр нь Kling/piapi-ийн `/ai` студийн нийтийн урсгал, энэ нь Seedance-ийн
// хувийн ажлын дэвтэр. Хоёр өөр ханган нийлүүлэгч, хоёр өөр үнэ, хоёр
// өөр амьдралын мөчлөгийг нэг хүснэгтэд шахвал аль аль нь эвдэрнэ.
//
// `AiImage`-тэй ижил зарчим: ОРОЛДЛОГО БҮР бичигдэнэ — амжилтгүй нь ч
// (status "failed", refunded: true) — тэгснээр админы зарлагын тайлан
// CreditTx-тэй кредит нэг бүрчлэн тулна.
//
// АСИНХРОН тул "processing" гэсэн ГУРАВДАХЬ төлөв байна: даалгавар
// илгээгдсэн, кредит авагдсан, видео хараахан гараагүй.

export type AiVideoStatus = "processing" | "done" | "failed";

export interface IAiVideo extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  // ── Оролт ──
  prompt: string;
  modelId: string;      // манай каталогийн id: seedance25 | seedance20
  providerModel: string; // ModelArk-д илгээсэн ID, ж: dreamina-seedance-2-5-260628
  mode: "text" | "image";
  imageUrl: string;     // эхлэх кадр (mode === "image" үед)
  ratio: string;        // "16:9" | "9:16" | "1:1" | "adaptive"
  ratioWire: string;    // ModelArk-д илгээсэн утга (Seedance-д ижил)
  generateAudio: boolean; // дуутай үүсгэсэн эсэх
  duration: number;     // секунд
  // ── Даалгавар ──
  taskId: string;
  status: AiVideoStatus;
  videoUrl: string;     // /uploads/tool-vid-*.mp4
  mime: string;
  bytes: number;
  error: string;
  progress: number;     // 0..1, зөвхөн боловсруулж байхад
  durationMs: number;   // илгээснээс бэлэн болтол
  // ── Мөнгө ──
  cost: number;          // гишүүнээс авсан Antaqor кредит
  refunded: boolean;
  /* ModelArk-ийн ТОКЕН — манай ЖИНХЭНЭ өртөг. Даалгавар үүсгэхэд
     таамаг ИРДЭГГҮЙ; дуусахад `usage.total_tokens` болж ирнэ. Энэ нь
     үнэ тогтоох ганц үнэн эх сурвалж: таамаглалаар биш, хэмжилтээр
     үнэлэх боломж олгоно. */
  providerTokens: number;
  // ── Нийгэм ──
  sharedPostId?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AiVideoSchema = new Schema<IAiVideo>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prompt: { type: String, default: "", maxlength: 4000 },
    modelId: { type: String, default: "seedance25", index: true },
    providerModel: { type: String, default: "" },
    mode: { type: String, enum: ["text", "image"], default: "text" },
    imageUrl: { type: String, default: "" },
    ratio: { type: String, default: "16:9" },
    ratioWire: { type: String, default: "" },
    generateAudio: { type: Boolean, default: false },
    duration: { type: Number, default: 5 },
    taskId: { type: String, default: "", index: true },
    status: { type: String, enum: ["processing", "done", "failed"], default: "processing", index: true },
    videoUrl: { type: String, default: "" },
    mime: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    error: { type: String, default: "", maxlength: 500 },
    progress: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    cost: { type: Number, default: 0 },
    refunded: { type: Boolean, default: false },
    providerTokens: { type: Number, default: 0 },
    sharedPostId: { type: Schema.Types.ObjectId, ref: "Post" },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

AiVideoSchema.index({ user: 1, createdAt: -1 });
AiVideoSchema.index({ createdAt: -1 });
AiVideoSchema.index({ status: 1, createdAt: -1 });

const AiVideo: Model<IAiVideo> =
  mongoose.models.AiVideo || mongoose.model<IAiVideo>("AiVideo", AiVideoSchema);

export default AiVideo;
